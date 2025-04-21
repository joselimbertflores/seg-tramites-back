import {
  Injectable,
  HttpException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { ClientSession, Connection, Document, FilterQuery, Model, mongo } from 'mongoose';
import { addDays, isWeekend } from 'date-fns';

import { Procedure, ProcedureDocument, procedureState } from 'src/modules/procedures/schemas';
import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { Account } from 'src/modules/administration/schemas';

import { PaginationDto } from 'src/modules/common';
import { EnvVars } from 'src/config';
import { RecipientDto, CreateCommunicationDto, ReplyCommunicationDto, SelectedCommunicationsDto } from '../dtos';

interface communicationProps {
  procedure: ProcedureDocument;
  recipient: Account;
  sender: Account;
  sentDate: Date;
  attachmentsCount: string;
  internalNumber: string;
  reference: string;
  isOriginal?: boolean;
  parentId?: string;
}
interface buildCommunicationsProps {
  sender: Account;
  communicationDto: CreateCommunicationDto;
  parentId?: string;
  newStructure: boolean;
}
@Injectable()
export class OutboxService {
  private readonly AUTO_REJECT_DAYS = this.configService.get<number>('AUTO_REJECT_DAYS');

  constructor(
    @InjectModel(Communication.name) private outboxModel: Model<CommunicationDocument>,
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectConnection() private connection: Connection,
    private configService: ConfigService<EnvVars>,
  ) {}

  async findAll(accountId: string, { limit, offset, term }: PaginationDto) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<Communication> = {
      'sender.account': accountId,
      status: { $in: [communicationStatus.Pending, communicationStatus.Rejected, communicationStatus.AutoRejected] },
      ...(term && { $or: [{ 'procedure.code': regex }, { 'recipient.fullname': regex }] }),
    };
    const [communications, length] = await Promise.all([
      this.outboxModel.find(query).lean().skip(offset).limit(limit).sort({ sentDate: 'descending' }),
      this.outboxModel.countDocuments(query),
    ]);
    return { communications: communications.map((item) => this.plainCommunication(item)), length };
  }

  async initiateCommunication(account: Account, communicationDto: CreateCommunicationDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const { procedure, userCommunications } = await this.buildCommunications({
        communicationDto,
        sender: account,
        newStructure: true,
      });

      if (procedure.state !== procedureState.INSCRITO) {
        throw new BadRequestException(`The procedure has already started.`);
      }

      const communications = userCommunications.map(({ communication }) => communication);
      this.validateCommunicationType(communications, true);

      await this.outboxModel.insertMany(communications, { session });
      await this.procedureModel.updateOne({ _id: procedure._id }, { state: procedureState.EN_REVISION }, { session });
      await session.commitTransaction();
      return userCommunications;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async forwardCommunication(account: Account, { communicationId, ...props }: ReplyCommunicationDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const current = await this.outboxModel.findById(communicationId, null, { session });
      if (!current) throw new BadRequestException(`Communication ${communicationId} not found`);

      if (current.status !== communicationStatus.Received) {
        throw new BadRequestException('El envio actual no esta recibido');
      }

      if (String(current.recipient.account._id) !== String(account._id)) {
        throw new BadRequestException(`Invalid communication: you are not the current recipient.`);
      }
      const { userCommunications } = await this.buildCommunications({
        communicationDto: props,
        sender: account,
        parentId: current._id.toString(),
        newStructure: typeof current.isOriginal === 'boolean',
      });

      const communications = userCommunications.map(({ communication }) => communication);
      this.validateCommunicationType(communications, current.isOriginal);

      await this.outboxModel.insertMany(communications, { session });

      await current.updateOne({ status: communicationStatus.Completed }, { session });

      await session.commitTransaction();
      return userCommunications;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async resendCommunication(account: Account, { communicationId, ...props }: ReplyCommunicationDto) {
    const current = await this.outboxModel.findOne({ _id: communicationId, 'sender.account': account._id });

    if (!current) {
      throw new NotFoundException(`Communication:${communicationId} / recipient:${account.id} not found`);
    }

    const { userCommunications } = await this.buildCommunications({
      communicationDto: props,
      sender: account,
      parentId: current.parentId?._id.toString(),
      newStructure: typeof current.isOriginal === 'boolean',
    });

    const communications = userCommunications.map(({ communication }) => communication);

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      switch (current.status) {
        case communicationStatus.Rejected:
          this.validateCommunicationType(communications, current.isOriginal);
          await current.updateOne({ status: communicationStatus.Forwarding }, { session });
          break;

        case communicationStatus.AutoRejected:
          this.validateCommunicationType(communications, current.isOriginal);
          await current.deleteOne({ session });
          break;

        case communicationStatus.Pending:
          if (!current.isOriginal) throw new BadRequestException('No puede realizar mas envios de una copia');
          if (communications.some(({ isOriginal }) => isOriginal)) {
            throw new BadRequestException('The original procedure has already been sent.');
          }
          break;

        default:
          throw new ConflictException('This communication cannot be resend.');
      }
      await this.outboxModel.insertMany(communications, { session });

      await session.commitTransaction();

      return userCommunications.map(({ toUser, communication }) => ({
        toUser,
        communication: this.plainCommunication(communication),
      }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async cancel(account: Account, { ids }: SelectedCommunicationsDto) {
    const selectedItems = await this.getValidatedCommunications(ids, account, communicationStatus.Pending);

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const selectedItemsIds = selectedItems.map(({ _id }) => _id);

      await this.outboxModel.deleteMany({ _id: { $in: selectedItemsIds } }, { session });

      // * For old communications, with idOriginal as undefined
      const originals = selectedItems.filter((item) => item.isOriginal !== false);

      await this.restoreStages(originals, account, session);

      await session.commitTransaction();

      return {
        items: selectedItems.map(({ id, recipient }) => ({
          toUser: String(recipient.account.user._id),
          communicationId: id,
        })),
        message: `Total de envios cancelados: ${selectedItemsIds.length}`,
        ids: selectedItemsIds,
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error in cancel communications');
    } finally {
      await session.endSession();
    }
  }

  private async buildCommunications({ communicationDto, sender, newStructure, parentId }: buildCommunicationsProps) {
    const { procedureId, recipients, ...props } = communicationDto;
    const procedure = await this.getValidProcedure(communicationDto.procedureId);
    const recipientAccounts = await this.validateAndRetrieveRecipients(sender, recipients, procedureId);
    const sentDate = new Date();

    return {
      procedure,
      userCommunications: recipientAccounts.map(({ toUser, isOriginal, recipient }) => ({
        toUser,
        communication: this.buildCommunicationInstance({
          ...props,
          recipient,
          procedure,
          sentDate,
          sender,
          parentId,
          ...(newStructure && { isOriginal }),
        }),
      })),
    };
  }

  private async getValidProcedure(id: string) {
    const procedure = await this.procedureModel.findById(id);
    if (!procedure) throw new NotFoundException(`Procedure ${id} not found`);
    return procedure;
  }

  private async validateAndRetrieveRecipients(sender: Account, recipients: RecipientDto[], procedureId: string) {
    const recipientIds = recipients.map(({ accountId }) => accountId);
    if (recipientIds.includes(String(sender._id))) {
      throw new BadRequestException('You cannot send a message to yourself');
    }
    const accountsMap = await this.getRecipientAccountsMap(recipients);
    const validRecipients = this.mapRecipients(recipients, accountsMap);

    await this.validateNoDuplicateRecipients(procedureId, accountsMap);

    return validRecipients;
  }

  private async getRecipientAccountsMap(recipients: RecipientDto[]) {
    const recipientIds = recipients.map(({ accountId }) => accountId);
    const accounts = await this.accountModel.find({ _id: { $in: recipientIds } }).populate('officer');
    return new Map(accounts.map((acc) => [String(acc._id), acc]));
  }

  private async validateNoDuplicateRecipients(procedureId: string, accounts: Map<string, Account>) {
    const duplicate = await this.outboxModel.findOne(
      {
        status: { $in: [communicationStatus.Pending, communicationStatus.Received] },
        'procedure.ref': procedureId,
        'recipient.account': { $in: Array.from(accounts.keys()) },
      },
      { recipient: 1 },
    );
    if (duplicate) {
      throw new BadRequestException(`${duplicate.recipient.fullname} ya tiene el trámite en su bandeja`);
    }
  }

  private async restoreStages(items: CommunicationDocument[], sender: Account, session: ClientSession) {
    const procedureIds = [...new Set(items.map(({ procedure }) => procedure.ref._id))];

    const lastStages = await this.outboxModel
      .find({
        'procedure.ref': { $in: procedureIds },
        'recipient.account': sender._id,
        status: { $in: [communicationStatus.Completed, communicationStatus.Received] },
      })
      .sort({ _id: -1 })
      .lean();

    const updates: mongo.AnyBulkWriteOperation[] = lastStages.map((stage) => ({
      updateOne: {
        filter: { _id: stage._id },
        update: { status: communicationStatus.Received },
      },
    }));

    if (updates.length > 0) await this.outboxModel.bulkWrite(updates, { session });

    const affectedProcedureIds = new Set(lastStages.map(({ procedure }) => String(procedure.ref._id)));
    const proceduresToReset = procedureIds.filter((id) => !affectedProcedureIds.has(id.toString()));

    if (proceduresToReset.length > 0) {
      await this.procedureModel.updateMany(
        { _id: { $in: proceduresToReset } },
        { state: procedureState.INSCRITO },
        { session },
      );
    }
  }

  private buildCommunicationInstance({ sender, recipient, procedure, ...props }: communicationProps) {
    return new this.outboxModel({
      ...props,
      sender: {
        account: sender._id,
        dependency: sender.dependencia,
        institution: sender.institution,
        fullname: sender.officer.fullName,
        jobtitle: sender.jobtitle,
      },
      recipient: {
        account: recipient._id,
        dependency: recipient.dependencia,
        institution: recipient.institution,
        fullname: recipient.officer.fullName,
        jobtitle: recipient.jobtitle,
      },
      procedure: {
        ref: procedure._id,
        code: procedure.code,
        group: procedure.group,
        reference: procedure.reference,
      },
    });
  }

  private mapRecipients(recipients: RecipientDto[], accountMap: Map<string, Account>) {
    return recipients.map(({ accountId, isOriginal }) => {
      const account = accountMap.get(accountId);
      if (!account) throw new BadRequestException(`Recipient ${accountId} does not exist`);
      return { toUser: String(account.user._id), recipient: account, isOriginal };
    });
  }

  private plainCommunication(item: CommunicationDocument) {
    const plainObject = item instanceof Document ? item.toObject() : item;
    return {
      ...plainObject,
      ...(item.status === communicationStatus.Pending && { remainingTime: this.getRemaininginTime(item) }),
    };
  }

  private getRemaininginTime({ sentDate }: Communication): number {
    let expirationDate = new Date(sentDate);
    let remainingDays = this.AUTO_REJECT_DAYS;
    while (remainingDays > 0) {
      expirationDate = addDays(expirationDate, 1);
      if (!isWeekend(expirationDate)) remainingDays--;
    }
    return Math.max(0, expirationDate.getTime() - new Date().getTime());
  }

  private async getValidatedCommunications(ids: string[], account: Account, expectedStatus: communicationStatus) {
    const communications = await this.outboxModel
      .find({ _id: { $in: ids }, 'sender.account': account._id })
      .populate('recipient.account', 'user');

    const foundIds = new Set(communications.map((item) => item.id));

    const notFoundIds = ids.filter((id) => !foundIds.has(id));

    if (notFoundIds.length > 0) {
      throw new NotFoundException({ message: `Some elements with sender ${account.id} dont exist`, notFoundIds });
    }

    return this.validateStatusOrThrow(communications, expectedStatus);
  }

  private validateStatusOrThrow(communications: CommunicationDocument[], validStatus: communicationStatus) {
    const invalidItems = communications
      .filter(({ status }) => status !== validStatus)
      .map(({ id, procedure: { code }, status }) => ({ id, status, code }));

    if (invalidItems.length > 0) {
      throw new UnprocessableEntityException({
        message: `Some items do not have the expected status: ${validStatus}`,
        invalidItems,
      });
    }
    return communications;
  }

  private validateCommunicationType(communications: Communication[], isOriginal: boolean | undefined): void {
    if (isOriginal) {
      this.validateOriginalCommunication(communications);
    } else {
      this.validateCopyCommunication(communications);
    }
  }

  private validateOriginalCommunication(comms: Communication[]): void {
    const originalsCount = comms.filter(({ isOriginal }) => isOriginal).length;
    if (originalsCount !== 1) {
      throw new BadRequestException('Los envíos deben contener 1 trámite original');
    }
  }

  private validateCopyCommunication(comms: Communication[]): void {
    const originalsCount = comms.filter(({ isOriginal }) => isOriginal).length;
    if (originalsCount > 0) {
      throw new BadRequestException('Solo se puede enviar una copia de otra copia');
    }
    if (comms.length !== 1) {
      throw new BadRequestException('Solo se permite un destinatario para una copia');
    }
  }
}

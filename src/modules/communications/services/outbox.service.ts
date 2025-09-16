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
import { ClientSession, Connection, Document, FilterQuery, Model, mongo, Types } from 'mongoose';
import { addDays, isWeekend } from 'date-fns';

import { Procedure, ProcedureDocument, procedureState } from 'src/modules/procedures/schemas';
import { Communication, SendStatus } from '../schemas';
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
    private configService: ConfigService<EnvVars>,
    @InjectModel(Communication.name) private outboxModel: Model<Communication>,
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectConnection() private connection: Connection,
  ) {}

  async findAll(accountId: string, { limit, offset, term }: PaginationDto) {
    const query: FilterQuery<Communication> = {
      'sender.account': accountId,
      status: { $in: [SendStatus.Pending, SendStatus.Rejected, SendStatus.AutoRejected] },
    };
    if (term) {
      const regex = new RegExp(term, 'i');
      query.$or = [{ 'procedure.code': regex }, { 'procedure.reference': regex }];
    }
    const [communications, length] = await Promise.all([
      this.outboxModel.find(query).lean().skip(offset).limit(limit).sort({ sentDate: 'desc' }),
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

      if (current.status !== SendStatus.Received) {
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

      await current.updateOne({ status: SendStatus.Completed }, { session });

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

  async resendCommunication(account: Account, communicationDto: ReplyCommunicationDto) {
    const { communicationId, ...props } = communicationDto;
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
        case SendStatus.Rejected:
          this.validateCommunicationType(communications, current.isOriginal);
          await current.updateOne({ status: SendStatus.Forwarding }, { session });
          break;

        case SendStatus.AutoRejected:
          this.validateCommunicationType(communications, current.isOriginal);
          await current.deleteOne({ session });
          break;

        case SendStatus.Pending:
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
    const items = await this.getValidCommunicationsToCancel(ids, account.id);

    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      const itemIds = items.map((item) => item.id);

      await this.outboxModel.deleteMany({ _id: { $in: itemIds } }, { session });

      const restoreResult = await this.restoreCanceledCommunications(items, account, session);

      await session.commitTransaction();

      return {
        canceledCommunications: items.map((item) => ({
          toUser: item.recipient.account.user._id.toString(),
          id: item.id,
        })),
        restoredItems: restoreResult,
        canceledIds: itemIds,
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
        status: { $in: [SendStatus.Pending, SendStatus.Received] },
        'procedure.ref': procedureId,
        'recipient.account': { $in: Array.from(accounts.keys()) },
      },
      { recipient: 1 },
    );
    if (duplicate) {
      throw new BadRequestException(`${duplicate.recipient.fullname} ya tiene el trámite en su bandeja`);
    }
  }

  private async restoreCanceledCommunications(items: Communication[], sender: Account, session: ClientSession) {
    const communicationsToRestore: Types.ObjectId[] = [];
    const proceduresToRestore: Types.ObjectId[] = [];
    const resultList: { restoredType: string; code: string }[] = [];

    for (const item of items) {
      // * For old schemas without isOriginal
      if (item.isOriginal === undefined) {
        if (item.parentId) {
          communicationsToRestore.push(item.parentId._id);
          resultList.push({ restoredType: `inbox`, code: item.procedure.code });
        } else {
          const lastStage = await this.outboxModel
            .findOne({
              'procedure.ref': item.procedure.ref,
              'recipient.account': sender._id,
              status: { $in: [SendStatus.Completed, SendStatus.Received] },
            })
            .sort({ _id: 'desc' });

          if (lastStage) {
            communicationsToRestore.push(lastStage._id);
            resultList.push({ restoredType: 'inbox', code: lastStage.procedure.code });
          } else {
            proceduresToRestore.push(item.procedure.ref._id);
            resultList.push({ restoredType: `administration`, code: item.procedure.code });
          }
        }
      } else {
        // * for communications after first send
        if (item.parentId) {
          if (item.isOriginal) {
            communicationsToRestore.push(item.parentId._id);
            resultList.push({ restoredType: 'inbox', code: item.procedure.code });
          } else {
            if (item.parentId.isOriginal === false) {
              communicationsToRestore.push(item.parentId._id);
              resultList.push({ restoredType: 'inbox', code: item.procedure.code });
            }
          }
        } else {
          // * First communication and isOriginal restart procedure for new send
          if (item.isOriginal) {
            proceduresToRestore.push(item.procedure.ref._id);
            resultList.push({ restoredType: `administration`, code: item.procedure.code });
          }
        }
      }
    }

    if (communicationsToRestore.length > 0) {
      const updates: mongo.AnyBulkWriteOperation[] = communicationsToRestore.map((id) => ({
        updateOne: {
          filter: { _id: id },
          update: { status: SendStatus.Received },
        },
      }));
      await this.outboxModel.bulkWrite(updates, { session });
    }

    if (proceduresToRestore.length > 0) {
      await this.procedureModel.updateMany(
        { _id: { $in: proceduresToRestore } },
        { state: procedureState.INSCRITO },
        { session },
      );
    }
    return resultList;
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

  private plainCommunication(item: Communication) {
    const plainObject = item instanceof Document ? item.toObject() : item;
    return {
      ...plainObject,
      ...(item.status === SendStatus.Pending && { remainingTime: this.getRemaininginTime(item) }),
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

  private async getValidCommunicationsToCancel(ids: string[], accountId: string) {
    const items = await this.outboxModel.find({ _id: { $in: ids }, 'sender.account': accountId }).populate([
      { path: 'recipient.account', select: 'user' },
      { path: 'parentId', select: 'isOriginal' },
    ]);

    const foundIds = new Set(items.map((item) => item.id));

    const notFoundIds = ids.filter((id) => !foundIds.has(id));

    if (notFoundIds.length > 0) {
      throw new NotFoundException({ message: `Some elements with sender ${accountId} dont exist`, ids: notFoundIds });
    }

    const invalidItems = items.filter(({ status }) => status !== SendStatus.Pending && status !== SendStatus.AutoRejected);

    if (invalidItems.length > 0) {
      throw new UnprocessableEntityException({
        message: `Some items do not have the expected status: ${SendStatus.Pending}`,
        ids: invalidItems.map((item) => item.id),
      });
    }
    return items;
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

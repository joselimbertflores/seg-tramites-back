import {
  Injectable,
  GoneException,
  HttpException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';

import { ClientSession, Connection, FilterQuery, Model } from 'mongoose';

import { Procedure, ProcedureDocument, procedureState } from 'src/modules/procedures/schemas';
import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { Account } from 'src/modules/administration/schemas';

import { PaginationDto } from 'src/modules/common';
import { EnvVars } from 'src/config';
import {
  RecipientDto,
  CreateCommunicationDto,
  ResendCommunicationDto,
  ForwardCommunicationDto,
  SelectedCommunicationsDto,
} from '../dtos';

interface communicationProps {
  procedure: ProcedureDocument;
  recipient: Account;
  sender: Account;
  sentDate: Date;
  attachmentsCount: string;
  internalNumber: string;
  isOriginal: boolean;
  reference: string;
}

interface geValidtRecipientsProps {
  recipients: RecipientDto[];
  session: ClientSession;
  sender: Account;
  procedureId: string;
}

interface userCommunicationModels {
  recipients: RecipientDto[];
  session?: ClientSession;
  sender: Account;
  sentDate: Date;
  procedureId: string;
  attachmentsCount: string;
  internalNumber: string;
  reference: string;
}
@Injectable()
export class OutboxService {
  private readonly AUTO_REJECT_HOURS = this.configService.get<number>('AUTO_REJECT_HOURS');
  private readonly AUTO_REJECT_HOURS_MILISECONDS = this.AUTO_REJECT_HOURS * 60 * 60 * 1000;

  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
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
      this.communicationModel.find(query).skip(offset).limit(limit).sort({ sentDate: 'descending' }),
      this.communicationModel.count(query),
    ]);
    return { communications: communications.map((item) => this.plainCommunication(item)), length };
  }

  async initiateCommunication(account: Account, communicationDto: CreateCommunicationDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const { procedure, userCommunications } = await this.generateRecipientCommunications({
        sentDate: new Date(),
        sender: account,
        session,
        ...communicationDto,
      });

      if (procedure.state !== procedureState.INSCRITO) {
        throw new BadRequestException(`The procedure has already started.`);
      }
      const communications = userCommunications.map(({ communication }) => communication);
      this.validateCommunicationType(communications, true);

      await this.communicationModel.insertMany(communications, { session });
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

  async forwardCommunication(account: Account, { communicationId, ...props }: ForwardCommunicationDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const communication = await this.communicationModel.findById(communicationId, null, { session });
      if (!communication) throw new BadRequestException(`Communication ${communicationId} not found`);

      if (communication.status !== communicationStatus.Received) {
        throw new BadRequestException('El envio actual no esta recibido');
      }

      if (String(communication.recipient.account._id) !== String(account._id)) {
        throw new BadRequestException(`Invalid communication: you are not the current recipient.`);
      }
      const { userCommunications } = await this.generateRecipientCommunications({
        sentDate: new Date(),
        sender: account,
        session,
        ...props,
      });

      const communications = userCommunications.map(({ communication }) => communication);
      this.validateCommunicationType(communications, communication.isOriginal);

      await this.communicationModel.insertMany(communications, { session });

      await this.communicationModel.updateOne(
        { _id: communication._id },
        { status: communicationStatus.Completed },
        { session },
      );

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

  async resendCommunication(account: Account, { communicationId, ...props }: ResendCommunicationDto) {
    const current = await this.communicationModel.findOne({ _id: communicationId, 'sender.account': account._id });

    if (!current) {
      throw new BadRequestException(`Communication:${communicationId} / sender:${account.id} not found`);
    }

    const { userCommunications } = await this.generateRecipientCommunications({
      sentDate: new Date(),
      sender: account,
      ...props,
    });
    const communications = userCommunications.map(({ communication }) => communication);

    const { _id, isOriginal, status } = current;

    if (status === communicationStatus.Pending && this.checkExpiration(current).isExpired) {
      await this.communicationModel.updateOne({ _id }, { status: communicationStatus.AutoRejected });
      throw new GoneException('Communication has expired');
    }

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      switch (status) {
        case communicationStatus.Rejected:
          this.validateCommunicationType(communications, isOriginal);
          await this.communicationModel.updateOne({ _id }, { status: communicationStatus.Forwarding }, { session });
          break;

        case communicationStatus.AutoRejected:
          this.validateCommunicationType(communications, isOriginal);
          await this.communicationModel.deleteOne({ _id }, { session });
          break;

        case communicationStatus.Pending:
          if (!isOriginal) throw new BadRequestException('No puede realizar mas envios de una copia');
          if (communications.some(({ isOriginal }) => isOriginal)) {
            throw new BadRequestException('The original procedure has already been sent.');
          }
          break;

        default:
          throw new BadRequestException('This communication cannot be resend.');
      }
      await this.communicationModel.insertMany(communications, { session });

      await session.commitTransaction();

      return userCommunications.map(({ toUser, communication }) => ({
        toUser,
        communication: this.plainCommunication(communication),
      }));
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async cancel(account: Account, { communicationIds }: SelectedCommunicationsDto) {
    const current = await this.communicationModel
      .find({ _id: { $in: communicationIds } })
      .populate('recipient.account');

    const invalid = current.find(({ status }) => status !== communicationStatus.Pending);
    if (invalid) {
      throw new BadRequestException(`${invalid.recipient.fullname} ya ha evaluado el tramite`);
    }

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      await this.communicationModel.deleteMany({ _id: { $in: communicationIds } }, { session });
      for (const communication of current) {
        if (communication.isOriginal) {
          await this.restoreStage(communication, account, session);
        }
      }
      await session.commitTransaction();
      return current.map(({ id, recipient }) => ({
        toUser: String(recipient.account.user._id),
        communicationId: id,
      }));
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Ha ocurrido un error al cancelar');
    } finally {
      await session.endSession();
    }
  }

  private async generateRecipientCommunications({
    procedureId,
    recipients,
    sender,
    session,
    ...props
  }: userCommunicationModels) {
    const procedure = await this.getValidProcedure(procedureId);
    const recipientAccounts = await this.validateAndRetrieveRecipients({
      procedureId,
      recipients,
      sender,
      session,
    });

    return {
      procedure,
      userCommunications: recipientAccounts.map(({ toUser, isOriginal, recipient }) => ({
        toUser,
        communication: this.buildCommunicationInstance({
          recipient,
          procedure,
          sender,
          isOriginal,
          ...props,
        }),
      })),
    };
  }

  private async getValidProcedure(id: string) {
    const procedure = await this.procedureModel.findById(id);
    if (!procedure) throw new BadRequestException(`Procedure ${id} don't exist`);
    return procedure;
  }

  private async validateAndRetrieveRecipients({ recipients, session, sender, procedureId }: geValidtRecipientsProps) {
    const recipientIds = recipients.map(({ accountId }) => accountId);
    if (recipientIds.includes(String(sender._id))) {
      throw new BadRequestException('You cannot send a message to yourself');
    }
    const accountsMap = await this.getRecipientAccountsMap(recipients, session);
    const validRecipients = this.mapRecipients(recipients, accountsMap);

    await this.validateNoDuplicateRecipients(procedureId, accountsMap, session);

    return validRecipients;
  }

  private async getRecipientAccountsMap(recipients: RecipientDto[], session: ClientSession) {
    const recipientIds = recipients.map(({ accountId }) => accountId);
    const accounts = await this.accountModel
      .find({ _id: { $in: recipientIds } }, null, { session })
      .populate('officer');

    return new Map(accounts.map((acc) => [String(acc._id), acc]));
  }

  private async validateNoDuplicateRecipients(
    procedureId: string,
    accounts: Map<string, Account>,
    session: ClientSession,
  ) {
    const duplicate = await this.communicationModel.findOne(
      {
        status: { $in: [communicationStatus.Pending, communicationStatus.Received] },
        'procedure.ref': procedureId,
        'recipient.account': { $in: Array.from(accounts.keys()) },
      },
      { recipient: 1 },
      { session },
    );
    if (duplicate) {
      throw new BadRequestException(`${duplicate.recipient.fullname} ya tiene el trámite en su bandeja`);
    }
  }

  private async restoreStage({ procedure }: CommunicationDocument, sender: Account, session: ClientSession) {
    const lastStage = await this.communicationModel.findOneAndUpdate(
      {
        procedure: procedure.ref._id,
        'recipient.account': sender._id,
        status: { $in: [communicationStatus.Completed, communicationStatus.Received] },
      },
      { status: communicationStatus.Received },
      { sort: { _id: -1 }, session },
    );
    if (!lastStage) {
      await this.procedureModel.updateOne({ _id: procedure.ref._id }, { state: procedureState.INSCRITO }, { session });
    }
  }

  private buildCommunicationInstance({ sender, recipient, procedure, ...props }: communicationProps) {
    return new this.communicationModel({
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
        ref: procedure,
        code: procedure.code,
        group: procedure.group,
        reference: procedure.reference,
      },
      ...props,
    });
  }

  private mapRecipients(recipients: RecipientDto[], accountMap: Map<string, Account>) {
    return recipients.map(({ accountId, isOriginal }) => {
      const account = accountMap.get(accountId);
      if (!account) throw new BadRequestException(`Recipient ${accountId} does not exist`);
      return { toUser: String(account.user._id), recipient: account, isOriginal };
    });
  }

  private validateCommunicationType(communications: Communication[], isOriginal: boolean): void {
    const originals = communications.filter(({ isOriginal }) => isOriginal);
    if (isOriginal) {
      if (originals.length !== 1) {
        throw new BadRequestException('Los envíos deben contener 1 trámite original');
      }
    } else {
      if (communications.length > 1 || originals.length >= 1) {
        throw new BadRequestException('Solo se puede enviar una copia de otra copia');
      }
    }
  }

  private plainCommunication(item: CommunicationDocument) {
    if (item.status === communicationStatus.Pending) {
      const remainingTime = this.checkExpiration(item);
      return {
        ...item.toObject(),
        status: remainingTime === 0 ? communicationStatus.AutoRejected : item.status,
        remainingTime,
      };
    }
    return item.toObject();
  }

  private checkExpiration({ sentDate }: Communication) {
    const now = new Date();
    const expirationTime = sentDate.getTime() + this.AUTO_REJECT_HOURS_MILISECONDS;
    const remainingTimeInMilliseconds = expirationTime - now.getTime();
    return Math.max(0, remainingTimeInMilliseconds);
  }
}

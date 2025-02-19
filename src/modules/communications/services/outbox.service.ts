import {
  BadRequestException,
  GoneException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { ClientSession, Connection, FilterQuery, Model } from 'mongoose';

import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { Procedure, ProcedureDocument, procedureState } from 'src/modules/procedures/schemas';
import { Account } from 'src/modules/administration/schemas';

import { EnvVars } from 'src/config';
import { PaginationDto } from 'src/modules/common';
import {
  RecipientDto,
  CreateCommunicationDto,
  ForwardCommunicationDto,
  ResendCommunicationDto,
  SelectedCommunicationsDto,
} from '../dtos';

interface communicationProps {
  recipient: Account;
  sender: Account;
  procedure: ProcedureDocument;
  attachmentsCount: string;
  internalNumber: string;
  reference: string;
  sentDate: Date;
  isOriginal: boolean;
}

interface geValidtRecipientsProps {
  recipients: RecipientDto[];
  session: ClientSession;
  procedureId: string;
  sender: Account;
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
  private readonly autoRejectHours = this.configService.get<number>('AUTO_REJECT_HOURS');

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
    return { communications: this._plainCommunications(communications), length };
  }

  async initiateCommunication(account: Account, communicationDto: CreateCommunicationDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const { procedure, userCommunications } = await this._generateRecipientCommunications({
        sentDate: new Date(),
        sender: account,
        session,
        ...communicationDto,
      });

      if (procedure.state !== procedureState.INSCRITO) {
        throw new BadRequestException(`The procedure has already started.`);
      }
      const communications = userCommunications.map(({ communication }) => communication);
      this._validateCommunicationType(communications, true);

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
      const { userCommunications } = await this._generateRecipientCommunications({
        sentDate: new Date(),
        sender: account,
        session,
        ...props,
      });

      const communications = userCommunications.map(({ communication }) => communication);
      this._validateCommunicationType(communications, communication.isOriginal);

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
    const current = await this.communicationModel.findOne({
      _id: communicationId,
      'sender.account': account._id,
    });

    if (!current) {
      throw new BadRequestException(`Communication:${communicationId} / sender:${account.id} not found`);
    }
    const { userCommunications } = await this._generateRecipientCommunications({
      sentDate: new Date(),
      sender: account,
      ...props,
    });
    const communications = userCommunications.map(({ communication }) => communication);

    const { _id, isOriginal, status } = current;

    if (status === communicationStatus.Pending && this._isExpired(current)) {
      console.log('expirado');
      await this.communicationModel.updateOne({ _id: current._id }, { status: communicationStatus.AutoRejected });
      throw new GoneException('Communication has expired');
    }

    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      switch (status) {
        case communicationStatus.Rejected:
          this._validateCommunicationType(communications, isOriginal);
          await this.communicationModel.updateOne({ _id }, { status: communicationStatus.Forwarding }, { session });
          break;

        case communicationStatus.AutoRejected:
          this._validateCommunicationType(communications, isOriginal);
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
      return userCommunications;
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async cancel(account: Account, { communicationIds }: SelectedCommunicationsDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const communications = await this.communicationModel
        .find({ _id: { $in: communicationIds } }, null, { session })
        .populate('recipient.account');

      const isReceived = communications.find(({ status }) => status !== communicationStatus.Pending);
      if (isReceived) {
        throw new BadRequestException(`${isReceived.recipient.fullname} ya ha evaluado el tramite`);
      }
      await this.communicationModel.deleteMany({ _id: { $in: communicationIds } }, { session });
      for (const communication of communications) {
        if (communication.isOriginal) {
          await this._restoreStage(communication, account, session);
        }
      }
      await session.commitTransaction();
      return communications.map(({ _id, recipient }) => ({
        toUser: String(recipient.account.user._id),
        communicationId: String(_id),
      }));
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Ha ocurrido un error al cancelar');
    } finally {
      await session.endSession();
    }
  }

  private async _generateRecipientCommunications({
    procedureId,
    recipients,
    sender,
    session,
    ...props
  }: userCommunicationModels) {
    const procedure = await this._getValidProcedure(procedureId);
    const recipientAccounts = await this._validateAndRetrieveRecipients({
      procedureId,
      recipients,
      sender,
      session,
    });

    return {
      procedure,
      userCommunications: recipientAccounts.map(({ toUser, isOriginal, recipient }) => ({
        toUser,
        communication: this._buildCommunicationInstance({
          recipient,
          procedure,
          sender,
          isOriginal,
          ...props,
        }),
      })),
    };
  }

  private async _getValidProcedure(id: string, session?: ClientSession) {
    const procedure = await this.procedureModel.findById(id, null, { session });
    if (!procedure) throw new BadRequestException(`Procedure ${id} don't exist`);
    return procedure;
  }

  private async _validateAndRetrieveRecipients({ recipients, session, sender, procedureId }: geValidtRecipientsProps) {
    const recipientIds = recipients.map(({ accountId }) => accountId);
    if (recipientIds.includes(String(sender._id))) {
      throw new BadRequestException('You cannot send a message to yourself');
    }
    const accountsMap = await this._getRecipientAccountsMap(recipients, session);
    const validRecipients = this._mapRecipients(recipients, accountsMap);

    await this._validateNoDuplicateRecipients(procedureId, accountsMap, session);

    return validRecipients;
  }

  private async _getRecipientAccountsMap(recipients: RecipientDto[], session: ClientSession) {
    const recipientIds = recipients.map(({ accountId }) => accountId);
    const accounts = await this.accountModel
      .find({ _id: { $in: recipientIds } }, null, { session })
      .populate('officer');

    return new Map(accounts.map((acc) => [String(acc._id), acc]));
  }

  private async _validateNoDuplicateRecipients(
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

  private async _restoreStage({ procedure }: Communication, sender: Account, session: ClientSession) {
    const lastStage = await this.communicationModel.findOne(
      {
        procedure: procedure.ref._id,
        'recipient.account': sender._id,
        status: { $in: [communicationStatus.Completed, communicationStatus.Received] },
      },
      null,
      { sort: { _id: -1 }, session },
    );
    if (lastStage) {
      await this.communicationModel.updateOne(
        { _id: lastStage._id },
        { status: communicationStatus.Received },
        { session },
      );
    } else {
      await this.procedureModel.updateOne({ _id: procedure.ref._id }, { state: procedureState.INSCRITO }, { session });
    }
  }

  private _buildCommunicationInstance({ sender, recipient, procedure, ...props }: communicationProps) {
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

  private _mapRecipients(recipients: RecipientDto[], accountMap: Map<string, Account>) {
    return recipients.map(({ accountId, isOriginal }) => {
      const account = accountMap.get(accountId);
      if (!account) throw new BadRequestException(`Recipient ${accountId} does not exist`);
      return { toUser: String(account.user._id), recipient: account, isOriginal };
    });
  }

  private _validateCommunicationType(communications: Communication[], isOriginal: boolean): void {
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

  private _plainCommunications(communications: CommunicationDocument[]) {
    return communications.map((item) => {
      const isExpired = this._isExpired(item);
      if (item.status === communicationStatus.Pending && isExpired) {
        item.status = communicationStatus.AutoRejected;
      }
      return {
        ...item.toObject(),
      };
    });
  }

  private _isExpired({ sentDate }: Communication) {
    const now = new Date();
    const diffInHours = (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60);
    return diffInHours > this.autoRejectHours;
  }
}

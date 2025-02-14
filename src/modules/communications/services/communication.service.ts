import {
  Injectable,
  HttpException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';

import { ClientSession, Connection, FilterQuery, Model } from 'mongoose';

import { Procedure, ProcedureDocument, procedureState } from 'src/modules/procedures/schemas';
import { Account } from 'src/modules/administration/schemas';
import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { DocumentService } from '../../procedures/services/document.service';
import {
  FilterInboxDto,
  ForwardCommunicationDto,
  RejectCommunicationDto,
  ResendCommunicationDto,
  SelectedCommunicationsDto,
} from '../dtos';
import { CreateCommunicationDto, RecipientDto } from '../dtos';

interface createModelProps {
  recipientAccount: Account;
  currentAccount: Account;
  procedure: ProcedureDocument;
  attachmentsCount: string;
  internalNumber: string;
  reference: string;
  sentDate: Date;
  isOriginal: boolean;
}

@Injectable()
export class CommunicationService {
  private readonly autoRejectHours = this.configService.get<number>('AUTO_REJECT_HOURS');

  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectConnection() private connection: Connection,
    private docService: DocumentService,
    private configService: ConfigService,
  ) {}

  async getInbox(accountId: string, filterDto: FilterInboxDto) {
    const { limit, offset, isOriginal, status, term, group } = filterDto;
    const regex = new RegExp(filterDto.term, 'i');
    const filterQuery: FilterQuery<Communication> = {
      'recipient.account': accountId,
      ...(status ? { status } : { status: { $in: [communicationStatus.Received, communicationStatus.Pending] } }),
      ...(term && { $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }] }),
      ...(isOriginal !== undefined && { isOriginal: isOriginal }),
      ...(group && { 'procedure.group': filterDto.group }),
    };
    const [communications, length] = await Promise.all([
      this.communicationModel.find(filterQuery).limit(limit).skip(offset).sort({ sentDate: -1 }),
      this.communicationModel.count(filterQuery),
    ]);
    return { communications, length };
  }

  async create(communicationDto: CreateCommunicationDto, account: Account) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { procedureId, documentId, recipients, ...props } = communicationDto;
      await this._checkDuplicate(procedureId, recipients, session);
      await this._setProcessState(communicationDto, account, session);

      const procedure = await this.procedureModel.findById(
        procedureId,
        { code: 1, group: 1, reference: 1 },
        { session },
      );
      if (!procedure) throw new BadRequestException(`Procedure ${procedureId} don't exist`);

      if (documentId) {
        await this.docService.attachProcedure(documentId, { code: procedure.code, group: procedure.group }, session);
      }

      const sentDate = new Date();
      const recipientAccounts = await this.accountModel
        .find({ _id: { $in: recipients.map(({ accountId }) => accountId) } }, null, { session })
        .populate('officer');
      const communications: { toUser: string; data: Communication }[] = recipientAccounts.map((el) => ({
        toUser: String(el.user._id),
        data: new this.communicationModel({
          sender: {
            account: account._id,
            dependency: account.dependencia,
            institution: account.institution,
            fullname: account.officer.fullName,
            jobtitle: account.jobtitle,
          },
          recipient: {
            account: el._id,
            dependency: el.dependencia,
            institution: el.institution,
            fullname: el.officer.fullName,
            jobtitle: el.jobtitle,
          },
          procedure: {
            ref: procedure._id,
            code: procedure.code,
            group: procedure.group,
            reference: procedure.reference,
          },
          isOriginal: recipients.find(({ accountId }) => accountId === String(el._id)).isOriginal,
          sentDate,
          ...props,
        }),
      }));
      await this.communicationModel.insertMany(
        communications.map(({ data }) => data),
        { session },
      );
      await session.commitTransaction();
      return communications;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async accept({ communicationIds }: SelectedCommunicationsDto): Promise<{ message: string }> {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const documents = await this.communicationModel.find({ _id: { $in: communicationIds } }, null, { session });
      if (documents.length !== communicationIds.length) {
        throw new BadRequestException(`Algunos de los elementos seleccionados no son validos`);
      }
      const isInvalid = documents.find(({ status }) => status !== communicationStatus.Pending);
      if (isInvalid) {
        throw new BadRequestException(`Invalid: ${isInvalid._id}, state is ${isInvalid.status}`);
      }
      await this.communicationModel.updateMany(
        { _id: { $in: communicationIds } },
        { status: communicationStatus.Received, receivedDate: new Date() },
        { session },
      );
      await session.commitTransaction();
      return { message: 'Tramite aceptado' };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async reject(account: Account, { description, communicationIds }: RejectCommunicationDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const documents = await this.communicationModel.find({ _id: { $in: communicationIds } }, null, { session });
      const isInvalid = documents.find(({ status }) => status !== communicationStatus.Pending);
      if (isInvalid) {
        throw new BadRequestException(`Invalid: ${isInvalid._id}, state is ${isInvalid.status}`);
      }
      const currentDate = new Date();
      await this.communicationModel.updateMany(
        { _id: { $in: communicationIds } },
        {
          receivedDate: currentDate,
          status: communicationStatus.Rejected,
          actionLog: { fullname: account.officer.fullName, date: currentDate, description },
        },
        { session },
      );
      await session.commitTransaction();
      return { message: 'Tramite rechazado' };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async getOne(communicationId: string, account: Account) {
    const communicationDb = await this.communicationModel.findById(communicationId).populate('procedure');
    if (!communicationDb) throw new BadRequestException(`Communication ${communicationId} don't exist`);
    if (String(account._id) !== String(communicationDb.recipient.account._id)) {
      throw new ForbiddenException('Unauthorized to access this communication');
    }
    return communicationDb;
  }

  async getWorkflow(procedureId: string) {
    return await this.communicationModel.find({ procedure: procedureId });
  }

  async initiateCommunication(account: Account, { procedureId, recipients, ...propsDto }: CreateCommunicationDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const procedure = await this._getProcedure(procedureId, session);
      if (procedure.state !== procedureState.INSCRITO) throw new BadRequestException(`Procedure is started`);

      const accounts = await this._getValidRecipients(recipients, session);

      const sentDate = new Date();
      const data = accounts.map(({ recipient, isOriginal, toUser }) => ({
        communication: this._createModel({
          currentAccount: account,
          recipientAccount: recipient,
          procedure,
          sentDate,
          isOriginal,
          ...propsDto,
        }),
        toUser: String(toUser),
      }));
      await this.communicationModel.insertMany(
        data.map(({ communication }) => communication),
        { session },
      );
      await this.procedureModel.updateOne({ _id: procedureId }, { state: procedureState.EN_REVISION }, { session });
      await session.commitTransaction();
      return data;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async forwardCommunication({ communicationId, recipients }: ForwardCommunicationDto, account: Account) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const communication = await this.communicationModel.findById(communicationId, null, { session });
      if (!communication) throw new BadRequestException(`Communication ${communicationId} not found`);

      if (communication.status !== communicationStatus.Received) {
        throw new BadRequestException('El envio actual no esta recibido');
      }

      const accounts = await this._getValidRecipients(recipients, session);

      await this.communicationModel.updateOne(
        { _id: communication._id },
        { status: communicationStatus.Completed },
        { session },
      );
      // const procedure = await this._getProcedure(procedureId, session);
      // if (procedure.state !== procedureState.INSCRITO) throw new BadRequestException(`Procedure is started`);

      // const accounts = await this._getValidRecipients(recipients, session);

      // const sentDate = new Date();
      // const data = accounts.map(({ recipient, isOriginal, toUser }) => ({
      //   communication: this._createModel({
      //     currentAccount: account,
      //     recipientAccount: recipient,
      //     procedure,
      //     sentDate,
      //     isOriginal,
      //     ...propsDto,
      //   }),
      //   toUser: String(toUser),
      // }));
      // await this.communicationModel.insertMany(
      //   data.map(({ communication }) => communication),
      //   { session },
      // );

      await session.commitTransaction();
      // return data;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async resendCommunication({ communicationId, recipients }: ResendCommunicationDto, account: Account) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const communication = await this.communicationModel.findById(communicationId, null, { session });
      if (!communication) throw new BadRequestException(`Communication ${communicationId} not found`);
      const { _id, isOriginal } = communication;

      const sentDate = new Date();
      const now = new Date();
      const expirationTime = new Date(now.getTime() - this.autoRejectHours * 60 * 60 * 1000);
      const isExpired = sentDate <= expirationTime;

      switch (communication.status) {
        case communicationStatus.Pending:
          if (isExpired) {
            // * Si el envio expiro, se debe eliminar este elemento para ser remplazado con los nuevos envios
            await this.communicationModel.deleteOne({ _id }, { session });
          } else {
            //  * Si el tramite no expiro, se pueden agregar mas envios al existente, solo si:
            //  * - Es original
            //  * - Se estan eviando solo copias, el original es el actual
            if (!isOriginal) throw new BadRequestException('No puede realizar mas envios de una copia');
            if (recipients.some(({ isOriginal }) => isOriginal)) {
              throw new BadRequestException('El tramite original ya ha sido enviado');
            }
          }
          break;

        case communicationStatus.Rejected:
          this._checkCommunicationType(recipients, isOriginal);
          await this.communicationModel.updateOne({ _id }, { status: communicationStatus.Forwarding }, { session });
          break;

        case communicationStatus.AutoRejected:
          this._checkCommunicationType(recipients, isOriginal);
          await this.communicationModel.deleteOne({ _id }, { session });
          break;

        default:
          throw new BadRequestException('No se puede realizar un nuevo envio');
      }

      await session.commitTransaction();
      // return data;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  private async _getProcedure(id: string, session?: ClientSession) {
    const procedure = await this.procedureModel.findById(id, null, { session });
    if (!procedure) throw new BadRequestException(`Procedure ${id} don't exist`);
    return procedure;
  }

  private async _getValidRecipients(recipients: RecipientDto[], session?: ClientSession) {
    const recipientIds = recipients.map(({ accountId }) => accountId);

    const accounts = await this.accountModel
      .find({ _id: { $in: recipientIds } }, null, { session })
      .populate('officer');

    const accountMap: Map<string, Account> = new Map(accounts.map((acc) => [acc._id.toString(), acc]));

    return recipients.map(({ accountId, isOriginal }) => {
      const account = accountMap.get(accountId);
      if (!account) throw new BadRequestException(`Recipient ${accountId} does not exist`);
      return { toUser: account.user._id, recipient: account, isOriginal };
    });

    const query: FilterQuery<Communication> = {
      status: { $in: [communicationStatus.Pending, communicationStatus.Received] },
      'procedure.ref': procedureId,
      'recipient.account': { $in: accounts.map(({ _id }) => _id) },
    };
    const duplicate = await this.communicationModel.findOne(query, { recipient: 1 }, { session });
    if (duplicate) {
      throw new BadRequestException(`${duplicate.recipient.fullname} ya tiene el tramite en su bandeja`);
    }
  }

  private async _setProcessState(
    { communicationId, recipients, procedureId }: CreateCommunicationDto,
    account: Account,
    session: ClientSession,
  ) {
    if (communicationId) {
      const communicationDB = await this.communicationModel.findById(communicationId, null, { session });
      if (!communicationDB) throw new BadRequestException(`El envio ${communicationId} no existe`);
      // * Envio desde bandeja de entrada
      if (String(communicationDB.recipient.account._id) === String(account._id)) {
        await this._sentFromInbox(communicationDB, recipients, session);
      }
      // * Envio desde bandeja de salida
      else if (String(communicationDB.sender.account._id) === String(account._id)) {
        await this._sendFromOutbox(communicationDB, recipients, session);
      } else {
        // * El envio no pertenece al usuario
        throw new BadRequestException('El envio actual no esta asociado a su cuenta');
      }
    } else {
      // * Primer envio
      this._checkRecipients(recipients, true);
      await this.procedureModel.updateOne({ _id: procedureId }, { state: procedureState.EN_REVISION }, { session });
    }
  }

  private async _checkDuplicateCommunication(procedureId: string, validAccounts: Account[], session: ClientSession) {
    const query: FilterQuery<Communication> = {
      status: { $in: [communicationStatus.Pending, communicationStatus.Received] },
      'procedure.ref': procedureId,
      'recipient.account': { $in: validAccounts.map(({ _id }) => _id) },
    };
    const duplicate = await this.communicationModel.findOne(query, { recipient: 1 }, { session });
    if (duplicate) {
      throw new BadRequestException(`${duplicate.recipient.fullname} ya tiene el tramite en su bandeja`);
    }
  }

  // Handle communicationSend
  private async _sendFromOutbox(
    currentCommunication: CommunicationDocument,
    recipients: RecipientDto[],
    session: ClientSession,
  ) {
    const { _id, isOriginal, status, sentDate } = currentCommunication;
    switch (status) {
      case communicationStatus.Pending:
        const now = new Date();
        const expirationTime = new Date(now.getTime() - this.autoRejectHours * 60 * 60 * 1000);
        const isExpired = sentDate <= expirationTime;

        if (isExpired) {
          // * Si el envio expiro, se debe eliminar este elemento para ser remplazado con los nuevos envios
          this._checkRecipients(recipients, isOriginal);
          await this.communicationModel.deleteOne({ _id }, { session });
        } else {
          // * Si el tramite no expiro, se pueden agregar mas envios al existente, solo si:
          //  * - Es original
          //  * - Se estan eviando solo copias, el original es el actual
          if (!isOriginal) throw new BadRequestException('No puede realizar mas envios de una copia');
          if (recipients.some(({ isOriginal }) => isOriginal)) {
            throw new BadRequestException('El tramite original ya ha sido enviado');
          }
        }
        break;

      case communicationStatus.Rejected:
        // * Marcar evio actual como completado (Rejected => Forwarding)
        this._checkRecipients(recipients, isOriginal);
        await this.communicationModel.updateOne({ _id }, { status: communicationStatus.Forwarding }, { session });
        break;

      default:
        throw new BadRequestException('El envio actual es invalido');
    }
  }

  private async _sentFromInbox(
    communication: CommunicationDocument,
    recipients: RecipientDto[],
    session: ClientSession,
  ) {
    // * El envio debe estar recibido para remitirlo
    if (communication.status !== communicationStatus.Received) {
      throw new BadRequestException('El envio actual no esta recibido');
    }
    this._checkRecipients(recipients, communication.isOriginal);
    // * Marcar el envio actual como completado para ya no mostrar en bandeja de entrada
    await this.communicationModel.updateOne(
      { _id: communication._id },
      { status: communicationStatus.Completed },
      { session },
    );
  }

  private _checkCommunicationType(recipients: RecipientDto[], isOriginal: boolean): void {
    const originals = recipients.filter(({ isOriginal }) => isOriginal);
    if (isOriginal) {
      if (originals.length !== 1) {
        throw new BadRequestException('Los envíos deben contener 1 trámite original');
      }
    } else {
      if (recipients.length > 1 || originals.length >= 1) {
        throw new BadRequestException('Solo se puede enviar una copia de otra copia');
      }
    }
  }

  private _createModel({
    recipientAccount,
    currentAccount,
    procedure,
    ...props
  }: createModelProps): CommunicationDocument {
    return new this.communicationModel({
      sender: {
        account: currentAccount._id,
        dependency: currentAccount.dependencia,
        institution: currentAccount.institution,
        fullname: currentAccount.officer.fullName,
        jobtitle: currentAccount.jobtitle,
      },
      recipient: {
        account: recipientAccount._id,
        dependency: recipientAccount.dependencia,
        institution: recipientAccount.institution,
        fullname: recipientAccount.officer.fullName,
        jobtitle: recipientAccount.jobtitle,
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
}

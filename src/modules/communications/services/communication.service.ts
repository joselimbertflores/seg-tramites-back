import {
  Injectable,
  HttpException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { ClientSession, Connection, FilterQuery, Model } from 'mongoose';

import { Procedure, procedureState } from 'src/modules/procedures/schemas';
import { Account } from 'src/modules/administration/schemas';
import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { DocumentService } from '../../procedures/services/document.service';
import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';
import { CreateCommunicationDto, RecipientDto } from '../dtos';

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

  private async _checkDuplicate(procedureId: string, recipients: RecipientDto[], session: ClientSession) {
    const query: FilterQuery<Communication> = {
      status: { $in: [communicationStatus.Pending, communicationStatus.Received] },
      'procedure.ref': procedureId,
      'recipient.account': { $in: recipients.map(({ accountId }) => accountId) },
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

  private _checkRecipients(recipients: RecipientDto[], isOriginal: boolean): void {
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
}

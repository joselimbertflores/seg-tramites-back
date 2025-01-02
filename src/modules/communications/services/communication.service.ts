import {
  Injectable,
  HttpException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, FilterQuery, Model } from 'mongoose';

import { Account } from 'src/modules/administration/schemas';
import { Communication, CommunicationDocument } from '../schemas/communication.schema';
import { stateProcedure, StatusMail } from '../../procedures/interfaces';
import { CreateCommunicationDto, RecipientDto } from '../dtos/communication.dto';
import { FilterInboxDto, FilterOutboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';
import { Procedure } from 'src/modules/procedures/schemas';
import { DocumentService } from 'src/modules/procedures/services';

@Injectable()
export class CommunicationService {
  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectConnection() private connection: Connection,
    private docService: DocumentService,
  ) {}

  async getInbox(accountId: string, { limit, offset, status, term, group, from }: FilterInboxDto) {
    const regex = new RegExp(term, 'i');
    const filterQuery: FilterQuery<Communication> = {
      'recipient.account': accountId,
      ...(status ? { status } : { $or: [{ status: StatusMail.Received }, { status: StatusMail.Pending }] }),
      ...(term && { $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }] }),
      ...(group && { 'procedure.group': group }),
      ...(from && { 'sender.fullname': new RegExp(from, 'i') }),
    };
    const [communications, length] = await Promise.all([
      this.communicationModel.find(filterQuery).limit(limit).skip(offset).sort({ sentDate: -1 }),
      this.communicationModel.count(filterQuery),
    ]);
    return { communications, length };
  }

  async getOutbox(accountId: string, { term, limit, offset, status, isOriginal }: FilterOutboxDto) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<Communication> = {
      'sender.account': accountId,
      ...(isOriginal !== undefined && { isOriginal }),
      $and: [
        {
          ...(status ? { status } : { $or: [{ status: StatusMail.Rejected }, { status: StatusMail.Pending }] }),
        },
        {
          ...(term && { $or: [{ reference: regex }, { 'recipient.fullname': regex }] }),
        },
      ],
    };
    const [communications, length] = await Promise.all([
      this.communicationModel.find(query).skip(offset).limit(limit).sort({ sentDate: -1 }),
      this.communicationModel.count(query),
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
      const isInvalid = documents.find(({ status }) => status !== StatusMail.Pending);
      if (isInvalid) {
        throw new BadRequestException(`Invalid: ${isInvalid._id}, state is ${isInvalid.status}`);
      }
      await this.communicationModel.updateMany(
        { _id: { $in: communicationIds } },
        { status: StatusMail.Received, receivedDate: new Date() },
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
      const isInvalid = documents.find(({ status }) => status !== StatusMail.Pending);
      if (isInvalid) {
        throw new BadRequestException(`Invalid: ${isInvalid._id}, state is ${isInvalid.status}`);
      }
      const currentDate = new Date();
      await this.communicationModel.updateMany(
        { _id: { $in: communicationIds } },
        {
          receivedDate: currentDate,
          status: StatusMail.Rejected,
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

  async cancel(account: Account, { communicationIds }: SelectedCommunicationsDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const documents = await this.communicationModel
        .find({ _id: { $in: communicationIds } }, null, { session })
        .populate('recipient.account');

      const isReceived = documents.find(({ status }) => status !== StatusMail.Pending);
      if (isReceived) {
        throw new BadRequestException(`${isReceived.recipient.fullname} ya ha evaluado el tramite`);
      }
      await this.communicationModel.deleteMany({ _id: { $in: communicationIds } }, { session });
      const originalDocuments = documents.filter(({ isOriginal }) => isOriginal);
      for (const communication of originalDocuments) {
        await this._restoreStage(communication, account, session);
      }
      await session.commitTransaction();
      return documents.map(({ _id, recipient }) => ({
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
        if (communicationDB.status !== StatusMail.Received) {
          throw new BadRequestException('El envio actual no esta recibido');
        }
        this._checkRecipients(recipients, communicationDB.isOriginal);
        // * Marcar el envio actual como completado para ya no mostrar en bandeja de entrada
        await this.communicationModel.updateOne(
          { _id: communicationId },
          { status: StatusMail.Completed },
          { session },
        );
      }
      // * Envio desde bandeja de salida
      if (String(communicationDB.sender.account._id) === String(account._id)) {
        switch (communicationDB.status) {
          case StatusMail.Pending:
            // * Si quiere realizar mas envios desde salida, debe ser el original
            if (!communicationDB.isOriginal) {
              throw new BadRequestException('No puede realizar mas envios de una copia');
            }
            // * Si es el original, esta en curso por lo que  no pueden haber mas originales
            if (recipients.some(({ isOriginal }) => isOriginal)) {
              throw new BadRequestException('Envio de original duplicado');
            }
            break;
          case StatusMail.Rejected:
            this._checkRecipients(recipients, communicationDB.isOriginal);
            await this.communicationModel.updateOne(
              { _id: communicationId },
              { status: StatusMail.Forwarding },
              { session },
            );
            break;
          default:
            throw new BadRequestException('El envio actual es invalido');
        }
      } else {
        // * El ennvio no pertenece al usuario
        throw new BadRequestException('El envio actual no esta asociado a su cuenta');
      }
    } else {
      // * Primer envio
      this._checkRecipients(recipients, true);
      await this.procedureModel.updateOne({ _id: procedureId }, { state: stateProcedure.EN_REVISION }, { session });
    }
  }

  private async _restoreStage(
    { procedure, isOriginal }: Communication,
    currentEmitter: Account,
    session: ClientSession,
  ): Promise<void> {
    if (!isOriginal) return;
    const lastStage = await this.communicationModel.findOne(
      {
        procedure: procedure.ref._id,
        'recipient.cuenta': currentEmitter._id,
        $or: [{ status: StatusMail.Completed }, { status: StatusMail.Received }],
      },
      null,
      { sort: { _id: -1 }, session },
    );
    if (lastStage) {
      await this.communicationModel.updateOne({ _id: lastStage._id }, { status: StatusMail.Received }, { session });
    } else {
      await this.procedureModel.updateOne({ _id: procedure.ref._id }, { state: stateProcedure.INSCRITO }, { session });
    }
  }

  private async _checkDuplicate(procedureId: string, recipients: RecipientDto[], session: ClientSession) {
    const query: FilterQuery<Communication> = {
      status: { $in: [StatusMail.Pending, StatusMail.Received] },
      'procedure.ref': procedureId,
      'recipient.cuenta': { $in: recipients.map(({ accountId }) => accountId) },
    };
    const duplicate = await this.communicationModel.findOne(query, { recipient: 1 }, { session });
    if (duplicate) {
      throw new BadRequestException(`${duplicate.recipient.fullname} ya tiene el tramite en su bandeja`);
    }
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

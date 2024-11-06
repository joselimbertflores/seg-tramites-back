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
import { Communication } from '../schemas/communication.schema';
import { stateProcedure, StatusMail } from '../../procedures/interfaces';
import { ProcedureBase } from '../../procedures/schemas';
import { CreateCommunicationDto, RecipientDto } from '../dtos/communication.dto';
import { FilterInboxDto, FilterOutboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';

interface setProcessStateProps {
  mailId: string | undefined;
  recipients: RecipientDto[];
  procedureId: string;
  session: ClientSession;
}
@Injectable()
export class CommunicationService {
  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<Communication>,
    @InjectModel(ProcedureBase.name) private procedureModel: Model<ProcedureBase>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async getInbox(accountId: string, { limit, offset, status, term, group, from }: FilterInboxDto) {
    const regex = new RegExp(term, 'i');
    const extraFilterQuery: FilterQuery<Communication> = {
      ...(term && { $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }] }),
      ...(group && { 'procedure.group': group }),
    };
    const [data] = await this.communicationModel
      .aggregate()
      .match({
        'recipient.cuenta': accountId,
        ...(status ? { status } : { $or: [{ status: StatusMail.Received }, { status: StatusMail.Pending }] }),
        ...(from && { 'sender.fullname': new RegExp(from, 'i') }),
      })
      .lookup({
        from: 'procedurebases',
        localField: 'procedure',
        foreignField: '_id',
        as: 'procedure',
      })
      .unwind('$procedure')
      .match(extraFilterQuery)
      .sort({ _id: -1 })
      .facet({
        results: [{ $skip: offset }, { $limit: limit }],
        total: [
          {
            $count: 'count',
          },
        ],
      });
    const communications = data.results;
    const length = data.total[0] ? data.total[0].count : 0;
    return { communications, length };
  }

  async getOutbox(accountId: string, { term, limit, offset, status, isOriginal }: FilterOutboxDto) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<Communication> = {
      'sender.cuenta': accountId,
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
      this.communicationModel.find(query).skip(offset).limit(limit).populate('procedure').sort({ sentDate: -1 }),
      this.communicationModel.count(query),
    ]);
    return { communications, length };
  }

  async create(communicationDto: CreateCommunicationDto, account: Account) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { procedureId, recipients, mailId, ...props } = communicationDto;
      await this._checkDuplicate(procedureId, recipients, session);
      await this._setProcessState({ mailId, procedureId, recipients, session });
      const sentDate = new Date();
      const models: Communication[] = recipients.map(
        (receiver) =>
          new this.communicationModel({
            sender: {
              cuenta: account._id,
              fullname: account.officer.fullName,
              jobtitle: account.jobtitle,
            },
            recipient: {
              cuenta: receiver.accountId,
              fullname: receiver.fullname,
              jobtitle: receiver.jobtitle,
            },
            procedure: procedureId,
            isOriginal: receiver.isOriginal,
            sentDate,
            ...props,
          }),
      );
      const results = await this.communicationModel.insertMany(models, { session });
      await this.communicationModel.populate(results, [{ path: 'procedure' }, { path: 'recipient.cuenta' }]);
      await session.commitTransaction();
      return results;
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
          actionLog: { manager: account.officer.fullName, date: currentDate, description },
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
        .populate('recipient.cuenta');
      const isReceived = documents.find(({ status }) => status !== StatusMail.Pending);
      if (isReceived) {
        throw new BadRequestException(`${isReceived.recipient.fullname} ya ha recibido el tramite`);
      }
      await this.communicationModel.deleteMany({ _id: { $in: communicationIds } }, { session });
      for (const { procedure, isOriginal } of documents) {
        const lastStage = await this.communicationModel.findOne(
          {
            procedure: procedure._id,
            'recipient.cuenta': account._id,
            $or: [{ status: StatusMail.Completed }, { status: StatusMail.Received }],
          },
          null,
          { session, sort: { _id: -1 } },
        );
        if (lastStage) {
          if (lastStage.isOriginal === isOriginal) {
            await this.communicationModel.updateOne(
              { _id: lastStage._id },
              { status: StatusMail.Received },
              { session },
            );
          }
        } else {
          await this.procedureModel.updateOne({ _id: procedure._id }, { state: stateProcedure.INSCRITO }, { session });
        }
      }
      await session.commitTransaction();
      return {
        message: `Se cancelaron ${documents.length} envios`,
        communications: documents,
      };
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
    if (String(account._id) !== String(communicationDb.recipient.cuenta._id)) {
      throw new ForbiddenException('Unauthorized to access this communication');
    }
    return communicationDb;
  }

  async getWorkflow(procedureId: string) {
    return await this.communicationModel.find({ procedure: procedureId });
  }

  private async _checkDuplicate(
    procedureId: string,
    recipients: RecipientDto[],
    session: ClientSession,
  ): Promise<void> {
    const duplicate = await this.communicationModel.findOne(
      {
        procedure: procedureId,
        $or: [{ status: StatusMail.Pending }, { status: StatusMail.Received }],
        'recipient.cuenta': { $in: recipients.map(({ accountId }) => accountId) },
      },
      null,
      { session },
    );

    if (duplicate) {
      const fullName = recipients.find(({ accountId }) => accountId == duplicate.recipient.cuenta._id).fullname;
      throw new BadRequestException(`${fullName} ya tiene el tramite en su bandeja`);
    }
  }

  private async _setProcessState({ mailId, session, recipients, procedureId }: setProcessStateProps): Promise<void> {
    if (mailId) {
      // Para envios desde bandeja de entrada y salida
      const communicationDB = await this.communicationModel.findById(mailId, null, { session });
      if (!communicationDB) throw new BadRequestException(`El envio ${mailId} no existe`);
      const validStatus = [StatusMail.Pending, StatusMail.Received, StatusMail.Rejected];
      if (!validStatus.includes(communicationDB.status)) {
        throw new BadRequestException(`El envio ${mailId} no puede remitirse`);
      }
      if (communicationDB.status !== StatusMail.Pending) {
        // Envios desde la bandeja de entrada
        // Completar el envio actual para siguiente etapa
        if (communicationDB.isOriginal) {
          const hasOriginal = recipients.some(({ isOriginal }) => isOriginal);
          if (!hasOriginal) {
            throw new BadRequestException('Debe enviar el orininal');
          }
        } else {
          if (recipients.length > 1) {
            throw new BadRequestException('Solo se puede enviar una copia');
          }
        }
        await this.communicationModel.updateOne(
          { _id: mailId },
          { status: communicationDB.status === StatusMail.Rejected ? StatusMail.Forwarding : StatusMail.Completed },
          { session },
        );
      } else {
        // Para realizar mas envios desde la bandeja de salida
        if (!communicationDB.isOriginal) {
          throw new BadRequestException('No puede realizar mas envios con una copia');
        }
        const hasOriginal = recipients.some(({ isOriginal }) => isOriginal);
        if (hasOriginal) {
          throw new BadRequestException('Envio de original duplicado');
        }
      }
    } else {
      // Primer envio
      const hasOriginal = recipients.some(({ isOriginal }) => isOriginal);
      if (!hasOriginal) {
        throw new BadRequestException('Debe enviar el original');
      }
      await this.procedureModel.updateOne({ _id: procedureId }, { state: stateProcedure.EN_REVISION }, { session });
    }
  }

  // private async _restoreStage(procedureId: string, senderAccountId: string, session: ClientSession): Promise<void> {
  //   const lastStage = await this.communicationModel.findOneAndUpdate(
  //     {
  //       procedure: procedureId,
  //       'recipient.cuenta': senderAccountId,
  //       $or: [{ status: StatusMail.Completed }, { status: StatusMail.Received }],
  //     },
  //     { status: StatusMail.Received },
  //     { session, sort: { _id: -1 } },
  //   );
  //   if (!lastStage) {
  //     await this.procedureModel.updateOne({ _id: procedureId }, { state: stateProcedure.INSCRITO }, { session });
  //   }
  // }
}

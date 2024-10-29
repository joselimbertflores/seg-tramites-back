import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, FilterQuery, Model } from 'mongoose';

import { Procedure, ProcedureBase } from '../../procedures/schemas';
import { stateProcedure, StatusMail } from '../../procedures/interfaces';
import { GetInboxParamsDto, UpdateCommunicationDto } from '../../procedures/dto';
import { Account } from 'src/modules/administration/schemas';
import { Communication } from '../schemas/communication.schema';
import { CreateCommunicationDto, RecipientDto } from '../dtos/communication.dto';
import { RejectCommunicationDto } from '../dtos';

interface setProcessStateProps {
  mailId: string | undefined;
  recipients: RecipientDto[];
  procedureId: string;
  session: ClientSession;
}
@Injectable()
export class InboxService {
  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<Communication>,
    @InjectModel(ProcedureBase.name) private procedureModel: Model<ProcedureBase>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async getMailDetails(id_mail: string, { _id }: Account) {
    // const mailDB = await this.commModel.findById(id_mail).populate('procedure');
    // if (!mailDB)
    //   throw new BadRequestException(
    //     'El envio de este tramite ha sido cancelado',
    //   );
    // if (String(_id) !== String(mailDB.receiver.cuenta._id))
    //   throw new ForbiddenException();
    // return mailDB;
  }

  async findAll(accountId: string, { limit, offset, status }: GetInboxParamsDto) {
    const query: FilterQuery<Communication> = {
      'recipient.cuenta': accountId,
      ...(status ? { status } : { $or: [{ status: StatusMail.Received }, { status: StatusMail.Pending }] }),
    };
    const [mails, length] = await Promise.all([
      this.communicationModel.find(query).skip(offset).limit(limit).sort({ sentDate: -1 }).populate('procedure').lean(),
      this.communicationModel.count(query),
    ]);
    return { mails, length };
  }

  async search(id_account: string, term: string, { limit, offset, status }: GetInboxParamsDto) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<Communication> = { 'receiver.cuenta': id_account };
    status ? (query.status = status) : (query.$or = [{ status: StatusMail.Received }, { status: StatusMail.Pending }]);
    const [data] = await this.communicationModel
      .aggregate()
      .match(query)
      .lookup({
        from: 'procedures',
        localField: 'procedure',
        foreignField: '_id',
        as: 'procedure',
      })
      .unwind('$procedure')
      .match({
        $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }],
      })
      .facet({
        paginatedResults: [{ $skip: offset }, { $limit: limit }],
        totalCount: [
          {
            $count: 'count',
          },
        ],
      });
    const mails = data.paginatedResults;
    const length = data.totalCount[0] ? data.totalCount[0].count : 0;
    return { mails, length };
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
      console.log(error);
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async accept(id: string): Promise<{ message: string }> {
    const communicationDb = await this.communicationModel.findById(id);
    if (!communicationDb) throw new NotFoundException('El envio del tramite ha sido cancelado');
    if (communicationDb.status !== StatusMail.Pending) throw new BadRequestException('El tramite ya ha sido aceptado');
    await this.communicationModel.updateOne({ _id: id }, { status: StatusMail.Received, receivedDate: new Date() });
    return { message: 'Tramite aceptado' };
  }

  async reject(id: string, account: Account, { description }: RejectCommunicationDto): Promise<{ message: string }> {
    const communicationDb = await this.communicationModel.findById(id);
    if (!communicationDb) throw new NotFoundException('El envio del tramite ha sido cancelado');
    if (communicationDb.status !== StatusMail.Pending) throw new BadRequestException('El tramite ya fue rechazado');
    const currentDate = new Date();
    await this.communicationModel.updateOne(
      { _id: id },
      {
        status: StatusMail.Rejected,
        receivedDate: currentDate,
        actionLog: { manager: account.officer.fullName, date: currentDate, description },
      },
    );
    return { message: 'Tramite rechazado' };
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

  private async checkIfMailsHaveBeenReceived(ids_mails: string[]): Promise<Communication[]> {
    const mails = await this.communicationModel.find({
      _id: { $in: ids_mails },
    });
    if (mails.length === 0) throw new BadRequestException('Los envios ya han sido cancelados');
    const receivedMail = mails.find((mail) => mail.status !== StatusMail.Pending);
    // if (receivedMail) {
    //   throw new BadRequestException(
    //     `El tramite ya ha sido ${
    //       receivedMail.status === StatusMail.Rejected ? 'rechazado' : 'recibido'
    //     } por el funcionario ${receivedMail.receiver.fullname}`,
    //   );
    // }
    return mails;
  }

  private async restoreStage(
    id_procedure: string,
    id_emiter: string,
    session: ClientSession,
  ): Promise<Communication | undefined> {
    const lastStage = await this.communicationModel.findOneAndUpdate(
      {
        procedure: id_procedure,
        'receiver.cuenta': id_emiter,
        $or: [{ status: StatusMail.Completed }, { status: StatusMail.Received }],
      },
      { status: StatusMail.Received },
      { session, sort: { _id: -1 }, new: true },
    );
    if (!lastStage) {
      const isProcessStarted = await this.communicationModel.findOne(
        { procedure: id_procedure, status: { $ne: StatusMail.Rejected } },
        null,
        { session },
      );
      await this.procedureModel.updateOne(
        { _id: id_procedure },
        {
          send: false,
          ...(!isProcessStarted && { state: stateProcedure.INSCRITO }),
        },
        { session },
      );
    }
    return lastStage;
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
}

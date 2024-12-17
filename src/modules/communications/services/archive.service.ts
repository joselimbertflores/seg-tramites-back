import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model } from 'mongoose';
import { CreateArchiveDto } from '../../procedures/dto';
import { stateProcedure, StatusMail } from '../../procedures/interfaces';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { Account } from 'src/modules/administration/schemas';
import { Communication } from '../schemas/communication.schema';

@Injectable()
export class ArchiveService {
  constructor(
    @InjectConnection() private connection: mongoose.Connection,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    // @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
    @InjectModel(Communication.name)
    private communicationModel: Model<Communication>,
  ) {}

  async create(
    id: string,
    account: Account,
    { description, state }: CreateArchiveDto,
  ) {
    // const mail = await this.communicationModel.findById(id);
    // if (mail.status !== StatusMail.Received)
    //   throw new BadRequestException(`El tramite no puede archivarse`);
    const session = await this.connection.startSession();
    try {
      // session.startTransaction();
      // const { officer } = await account.populate('funcionario');

      // // TODO repair fullname officer
      // await this.communicationModel.updateOne(
      //   { _id: id },
      //   {
      //     status: StatusMail.Archived,
      //     eventLog: {
      //       manager: '',
      //       description: description,
      //       date: new Date(),
      //     },
      //   },
      //   { session },
      // );
      // await this.concludeProcedureIfAppropriate(
      //   mail.procedure._id,
      //   state,
      //   session,
      // );
      await session.commitTransaction();
      return { message: 'Tramite archivado.' };
    } catch (error) {
      await session.abortTransaction();
      throw new InternalServerErrorException('Error al archivar envio', {
        cause: error,
      });
    } finally {
      session.endSession();
    }
  }

  async unarchiveMail(
    id_mail: string,
    account: Account,
  ): Promise<{ message: string }> {
    const mailDB = await this.communicationModel.findById(id_mail);
    if (mailDB.status !== StatusMail.Archived)
      throw new BadRequestException('El tramite ya fue desarchivado');
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      // let newStatus = StatusMail.Received;
      // if (String(mailDB.receiver.cuenta._id) !== String(account._id)) {
      //   await this.insertPartipantInWokflow(mailDB, account, session);
      //   newStatus = StatusMail.Completed;
      // }
      // await this.communicationModel.updateOne(
      //   { _id: id_mail },
      //   { status: newStatus, $unset: { eventLog: 1 } },
      //   { session },
      // );
      // await this.procedureModel.updateOne(
      //   { _id: mailDB.procedure._id },
      //   { state: stateProcedure.EN_REVISION, $unset: { endDate: 1 } },
      //   { session },
      // );
      await session.commitTransaction();
      return { message: 'Tramite desarchivado' };
    } catch (error) {
      await session.abortTransaction();
      throw new InternalServerErrorException('Error al desarchivar tramite', {
        cause: error,
      });
    } finally {
      session.endSession();
    }
  }

  async findAll({ limit, offset }: PaginationDto, account: Account) {
    const unit = await this.accountModel
      .find({ dependencia: account.dependencia._id })
      .select('_id');
    const query: FilterQuery<Communication> = {
      status: StatusMail.Archived,
      'receiver.cuenta': { $in: unit.map((acount) => acount._id) },
    };
    const [archives, length] = await Promise.all([
      this.communicationModel
        .find(query)
        .limit(limit)
        .skip(offset)
        .sort({ 'eventLog.date': -1 })
        .populate('procedure')
        .lean(),
      this.communicationModel.count(query),
    ]);
    return { archives, length };
  }

  async search(
    { limit, offset }: PaginationDto,
    text: string,
    id_dependency: string,
  ) {
    const unit = await this.accountModel
      .find({
        dependencia: id_dependency,
      })
      .select('_id');
    const ids_officers = unit.map((officer) => officer._id);
    const regex = new RegExp(text, 'i');
    const data = await this.communicationModel.aggregate([
      {
        $match: {
          status: StatusMail.Archived,
          'receiver.cuenta': { $in: ids_officers },
        },
      },
      {
        $lookup: {
          from: 'procedures',
          localField: 'procedure',
          foreignField: '_id',
          as: 'procedure',
        },
      },
      {
        $unwind: '$procedure',
      },
      {
        $match: {
          $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }],
        },
      },
      {
        $facet: {
          paginatedResults: [{ $skip: offset }, { $limit: limit }],
          totalCount: [
            {
              $count: 'count',
            },
          ],
        },
      },
    ]);
    const archives = data[0].paginatedResults;
    const length = data[0].totalCount[0] ? data[0].totalCount[0].count : 0;
    return { archives, length };
  }

  async checkIfProcedureCanBeCompleted(id_procedure: string): Promise<void> {
    // const procedureDB = await this.procedureModel.findById(id_procedure);
    // if (procedureDB.state === stateProcedure.CONCLUIDO) {
    //   throw new BadRequestException(
    //     `El tramite ${procedureDB.code} ya fue concluido.`,
    //   );
    // }
    // const isProcessStarted = await this.communicationModel.findOne({
    //   procedure: id_procedure,
    // });
    // if (isProcessStarted)
    //   throw new BadRequestException(
    //     'Solo puede concluir tramites que no hayan sido remitidos',
    //   );
  }

  async insertPartipantInWokflow(
    currentMail: Communication,
    participant: Account,
    session: mongoose.mongo.ClientSession,
  ): Promise<void> {
    const inboundDate = new Date();
    const outboundDate = new Date(inboundDate.getTime() + 1000);
    // const { receiver, attachmentQuantity, internalNumber } = currentMail;
    // const { officer } = await participant.populate({
    //   path: 'funcionario',
    //   populate: { path: 'cargo', select: 'nombre' },
    // });
    // const newMail = {
    //   procedure: currentMail.procedure._id,
    //   emitter: receiver,
    //   receiver: {
    //     cuenta: participant._id,
    //     // TODO repair user fullane
    //     fullname: '',
    //     ...(officer.cargo && { jobtitle: officer.cargo.nombre }),
    //   },
    //   outboundDate,
    //   inboundDate,
    //   reference: 'Solicita desarchivo',
    //   attachmentQuantity: attachmentQuantity,
    //   internalNumber: internalNumber,
    //   status: StatusMail.Received,
    // };
    // const createdMail = new this.communicationModel(newMail);
    // await createdMail.save({ session });
  }

  private async concludeProcedureIfAppropriate(
    id: string,
    state: stateProcedure.SUSPENDIDO | stateProcedure.CONCLUIDO,
    session: mongoose.mongo.ClientSession,
  ): Promise<void> {
    // const isProcessActive = await this.communicationModel.findOne(
    //   {
    //     procedure: id,
    //     status: { $in: [StatusMail.Received, StatusMail.Pending] },
    //   },
    //   undefined,
    //   { session },
    // );
    // if (isProcessActive) return;
    // await this.procedureModel.updateOne(
    //   { _id: id },
    //   { state: state, endDate: new Date() },
    //   { session },
    // );
  }
}

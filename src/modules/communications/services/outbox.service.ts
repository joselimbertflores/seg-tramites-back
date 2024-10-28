import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Connection, FilterQuery, Model } from 'mongoose';
import { Procedure, ProcedureBase } from '../../procedures/schemas';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { stateProcedure, StatusMail, workflow } from '../../procedures/interfaces';
import { HumanizeTime } from 'src/common/helpers';
import { Communication } from '../schemas/communication.schema';
import { Account } from 'src/modules/administration/schemas';
import { CancelCommunicationDto } from '../dtos';

@Injectable()
export class OutboxService {
  constructor(
    @InjectModel(Communication.name)
    private communicationModel: Model<Communication>,
    @InjectModel(ProcedureBase.name) private procedureModel: Model<ProcedureBase>,
    @InjectConnection() private connection: Connection,
  ) {}

  async findAll(accountId: string, { limit, offset }: PaginationDto) {
    const query: FilterQuery<Communication> = {
      'sender.cuenta': accountId,
      $or: [{ status: StatusMail.Rejected }, { status: StatusMail.Pending }],
    };
    const [mails, length] = await Promise.all([
      this.communicationModel.find(query).skip(offset).limit(limit).sort({ sentDate: -1 }).populate('procedure').lean(),
      this.communicationModel.count(query),
    ]);
    return { mails, length };
  }

  async search(id_account: string, text: string, { limit, offset }: PaginationDto) {
    const regex = new RegExp(text, 'i');
    const dataPaginated = await this.communicationModel
      .aggregate()
      .match({
        'emitter.cuenta': id_account,
        status: StatusMail.Pending,
      })
      .group({
        _id: {
          account: '$emitter.cuenta',
          procedure: '$procedure',
          outboundDate: '$outboundDate',
        },
        sendings: { $push: '$$ROOT' },
      })
      .lookup({
        from: 'procedures',
        localField: '_id.procedure',
        foreignField: '_id',
        as: '_id.procedure',
      })
      .unwind('_id.procedure')
      .match({
        $or: [{ '_id.procedure.code': regex }, { '_id.procedure.reference': regex }],
      })
      .facet({
        paginatedResults: [{ $skip: offset }, { $limit: limit }],
        totalCount: [
          {
            $count: 'count',
          },
        ],
      });
    const mails = dataPaginated[0].paginatedResults;
    const length = dataPaginated[0].totalCount[0] ? dataPaginated[0].totalCount[0].count : 0;
    return { mails, length };
  }

  async getWorkflow(id_procedure: string) {
    const workflow: workflow[] = await this.communicationModel
      .aggregate()
      .match({ procedure: new mongoose.Types.ObjectId(id_procedure) })
      .group({
        _id: { emitter: '$emitter', outboundDate: '$outboundDate' },
        dispatches: {
          $push: '$$ROOT',
        },
      })
      .sort({ '_id.outboundDate': 1 })
      .project({ 'dispatches.emitter': 0, 'dispatches.outboundDate': 0 });
    return await this.timedWorkflow(workflow, id_procedure);
  }

  private async timedWorkflow(workflow: workflow[], id_procedure: string) {
    // const { startDate } = await this.procedureModel.findById(id_procedure, 'startDate');
    // const receptionList: Record<string, Date> = {};
    // const stages = workflow.map(({ _id, dispatches }) => {
    //   dispatches.forEach((el) => (receptionList[el.receiver.cuenta] = el.inboundDate));
    //   const start = receptionList[_id.emitter.cuenta] ?? startDate;
    //   return {
    //     ..._id,
    //     duration: start ? HumanizeTime(_id.outboundDate.getTime() - start.getTime()) : 'No calculado',
    //     dispatches: dispatches.map((dispatch) => {
    //       const duration = dispatch.inboundDate
    //         ? HumanizeTime(dispatch.inboundDate.getTime() - _id.outboundDate.getTime())
    //         : 'Pendiente';
    //       return { ...dispatch, duration };
    //     }),
    //   };
    // });
    // return stages;
  }

  async cancel(account: Account, communicationDto: CancelCommunicationDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const communicationIds = communicationDto.selected.map(({ communicationId }) => communicationId);
      const communicationsDB = await this.communicationModel.find({
        _id: { $in: communicationIds },
      });
      if (communicationsDB.length !== communicationIds.length) {
        throw new BadRequestException(`Algunos de los envios seleccionados no existen`);
      }
      const recivedBy = communicationsDB.find(({ status }) => status !== StatusMail.Pending);
      if (recivedBy) {
        throw new BadRequestException(`${recivedBy.recipient.fullname} ya ha recibido el tramite`);
      }
      await this.communicationModel.deleteMany({ _id: { $in: communicationIds } }, { session });
      for (const communication of communicationsDB) {
        if (communication.isOriginal) {
          await this._restoreStage(communication.procedure._id, account._id, session);
        }
      }
      await session.commitTransaction();
      return {
        message: `Se cancelaron ${communicationsDB.length} envios`,
        communications: communicationsDB.map(({ _id, recipient }) => ({
          communicationId: _id,
          recipientId: recipient.cuenta,
        })),
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Ha ocurrido un error al cancelar');
    } finally {
      await session.endSession();
    }
  }

  async getLocation(id_procedure: string) {
    // const invalidStatus = [StatusMail.Completed, StatusMail.Rejected];
    // const location = await this.commModel
    //   .find({ procedure: id_procedure, status: { $nin: invalidStatus } })
    //   .select({ 'receiver.cuenta': 1, status: 1, _id: 0 })
    //   .populate({
    //     path: 'receiver.cuenta',
    //     select: 'funcionario',
    //     populate: [
    //       {
    //         path: 'funcionario',
    //         select: 'nombre paterno materno cargo -_id',
    //         populate: {
    //           path: 'cargo',
    //           select: 'nombre -_id',
    //         },
    //       },
    //       {
    //         path: 'dependencia',
    //         select: 'nombre -_id',
    //       },
    //     ],
    //   })
    //   .lean();
    // return location.map((el) => ({ ...el.receiver.cuenta, status: el.status }));
  }

  private async _restoreStage(procedureId: string, senderAccountId: string, session: ClientSession): Promise<void> {
    const lastStage = await this.communicationModel.findOneAndUpdate(
      {
        procedure: procedureId,
        'recipient.cuenta': senderAccountId,
        $or: [{ status: StatusMail.Completed }, { status: StatusMail.Received }],
      },
      { status: StatusMail.Received },
      { session, sort: { _id: -1 } },
    );
    if (!lastStage) {
      await this.procedureModel.updateOne({ _id: procedureId }, { state: stateProcedure.INSCRITO }, { session });
    }
  }
}

import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { CreateObservationDto } from '../dto';
import { stateProcedure } from '../interfaces';
import { Account } from 'src/modules/administration/schemas';

@Injectable()
export class ObservationService {
  constructor() // @InjectModel(Observation.name) private observationModel: Model<Observation>,
  // @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
  // @InjectModel(Account.name) private accountModel: Model<Account>,
  // @InjectConnection() private readonly connection: Connection,
  {}

  async getObservations(id_procedure: string) {
    // return await this.observationModel.find({ procedure: id_procedure }).sort({ date: -1 });
  }

  async add(id_procedure: string, account: Account, { description }: CreateObservationDto) {
    // const state = await this.checkIfStateProcedureIsValid(id_procedure);
    // const session = await this.connection.startSession();
    // try {
    //   session.startTransaction();
    //   if (state !== stateProcedure.OBSERVADO) {
    //     await this.procedureModel.findByIdAndUpdate(id_procedure, { state: stateProcedure.OBSERVADO }, { session });
    //   }
    //   const { officer } = await this.accountModel.populate(account, {
    //     path: 'funcionario',
    //   });
    //   // TODO repair fullname officer
    //   const newObservation = new this.observationModel({
    //     procedure: id_procedure,
    //     account: account._id,
    //     fullnameOfficer: 'user',
    //     description,
    //   });
    //   const createdObservation = await newObservation.save({ session });
    //   await session.commitTransaction();
    //   return createdObservation;
    // } catch (error) {
    //   await session.abortTransaction();
    //   throw new InternalServerErrorException('No se puede registrar la observacion');
    // } finally {
    //   session.endSession();
    // }
  }

  async checkIfStateProcedureIsValid(id_procedure: string) {
    // const procedureDB = await this.procedureModel.findById(id_procedure);
    // if (!procedureDB) throw new BadRequestException('El tramite no existe');
    // const invalidStates = [stateProcedure.ANULADO, stateProcedure.CONCLUIDO, stateProcedure.SUSPENDIDO];
    // if (invalidStates.includes(procedureDB.state)) throw new BadRequestException('El tramite ya ha sido finalizado');
    // return procedureDB.state;
  }

  async solve(id_observation: string) {
    // const session = await this.connection.startSession();
    // try {
    //   session.startTransaction();
    //   const observationDB = await this.observationModel.findByIdAndUpdate(
    //     id_observation,
    //     { isSolved: true },
    //     { session, new: true },
    //   );
    //   if (!observationDB) throw new BadRequestException('La observacion no existe');
    //   let state = stateProcedure.OBSERVADO;
    //   const pendingObservation = await this.observationModel.findOne(
    //     {
    //       procedure: observationDB.procedure._id,
    //       isSolved: false,
    //     },
    //     undefined,
    //     { session },
    //   );
    //   if (!pendingObservation) {
    //     await this.procedureModel.updateOne(
    //       { _id: observationDB.procedure._id },
    //       { state: stateProcedure.EN_REVISION },
    //       { session },
    //     );
    //     state = stateProcedure.EN_REVISION;
    //   }
    //   await session.commitTransaction();
    //   return { state };
    // } catch (error) {
    //   await session.abortTransaction();
    //   throw new InternalServerErrorException('No se puede registrar la observacion');
    // } finally {
    //   session.endSession();
    // }
  }
}

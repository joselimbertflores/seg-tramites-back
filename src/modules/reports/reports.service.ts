import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model, PipelineStage, Types } from 'mongoose';

import { Account, Dependency } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/modules/common';
import { ExternalProcedure, ExternalProcedureDocument, Procedure, ProcedureDocument } from '../procedures/schemas';
import {
  GetTotalCommunicationsByUnit,
  GetTotalProceduresByStateDto,
  SearchProcedureByApplicantDto,
  SearchProcedureDto,
} from './dtos';
import { Communication, CommunicationDocument } from '../communications/schemas';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectModel(Dependency.name) private dependencyModel: Model<Dependency>,
    @InjectModel(Procedure.name) private procedureModel: Model<ProcedureDocument>,
    @InjectModel(ExternalProcedure.name) private externalModel: Model<ExternalProcedureDocument>,
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
  ) {}

  async searchProcedureByProperties({ limit, offset }: PaginationDto, dto: SearchProcedureDto) {
    const { start, end, ...values } = dto;
    const query: mongoose.FilterQuery<Procedure>[] = Object.entries(values).map(([key, value]) => {
      if (key === 'code' || key === 'reference') return { [key]: new RegExp(value, 'i') };
      return { [key]: value };
    });
    const interval = { ...(start && { $gte: start }), ...(end && { $lte: end }) };
    if (Object.keys(interval).length > 0) query.push({ createdAt: interval });

    if (query.length < 2) {
      throw new BadRequestException('Debe proporcionar al menos 2 campos para realizar la búsqueda.');
    }

    const [procedures, length] = await Promise.all([
      this.procedureModel.find({ $and: query }).lean().limit(limit).skip(offset),
      this.procedureModel.countDocuments({ $and: query }),
    ]);
    return { procedures, length };
  }

  async searchProcedureByApplicant(
    { by, typeProcedure, properties }: SearchProcedureByApplicantDto,
    { limit, offset }: PaginationDto,
  ) {
    console.log(typeProcedure);
    const query: mongoose.FilterQuery<ExternalProcedure>[] = [
      // * aplicant props
      ...Object.entries(properties).map(([key, value]) => {
        if (key === 'firstname') return { [`${by}.${key}`]: new RegExp(value, 'i') };
        if (key === 'middlename' || key === 'lastname') return { [`${by}.${key}`]: { $regex: value, $options: 'i' } };
        return { [`${by}.${key}`]: value };
      }),
      ...(typeProcedure ? [{ type: typeProcedure }] : []),
    ];
    if (Object.keys(properties).length <= 1) {
      throw new BadRequestException('Debe proporcionar al menos 1 campo para realizar la búsqueda.');
    }
    const [procedures, length] = await Promise.all([
      this.externalModel.find({ $and: query }).lean().limit(limit).skip(offset),
      this.externalModel.countDocuments({ $and: query }),
    ]);
    return { procedures, length };
  }

  async getTotalCommunicationsByUnit(params: GetTotalCommunicationsByUnit, dependencyId: string) {
    const unit = await this.accountModel
      .find({ dependencia: dependencyId })
      .populate({ path: 'officer', select: 'nombre paterno materno' })
      .select('officer jobtitle');

    const pipeline: PipelineStage[] = [
      {
        $match: {
          'recipient.account': { $in: unit.map((account) => account._id) },
          status: { $in: ['pending', 'received', 'rejected', 'auto-rejected', 'archived'] },
          sentDate: {
            $gte: new Date(params.startDate),
            $lte: new Date(params.endDate),
          },
          ...(params.group && { ['procedure.group']: params.group }),
        },
      },
      // 2. Agrupar por cuenta (funcionario) y estado
      {
        $group: {
          _id: {
            account: `$recipient.account`,
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      // 3. Agrupar por cuenta y acumular statusCounts + total
      {
        $group: {
          _id: '$_id.account',
          statusCounts: {
            $push: {
              status: '$_id.status',
              count: '$count',
            },
          },
          total: { $sum: '$count' },
        },
      },
      {
        $sort: { total: -1 },
      },
    ];
    const result = await this.communicationModel.aggregate(pipeline);
    const mapResult = new Map(result.map(({ _id, ...props }) => [String(_id), props]));
    return unit.map((account) => ({
      id: account._id,
      fullName: account.officer?.fullName,
      jobTitle: account.jobtitle,
      ...(mapResult.get(String(account._id)) || { statusCounts: [], total: 0 }),
    }));
  }

  async getInboxByAccount(accountId: string) {
    return await this.communicationModel
      .find({
        'recipient.account': accountId,
        status: { $in: ['received', 'pending'] },
      })
      .lean();
  }

  async getTotalProceduresByState(params: GetTotalProceduresByStateDto) {
    console.log(params);
    const { startDate, endDate, institutionId } = params;
    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          ...(institutionId && { institution: new Types.ObjectId(institutionId) }),
        },
      },
      {
        $addFields: {
          category: '$status',
        },
      },
      {
        $group: {
          _id: {
            dependency: '$dependency',
            state: '$state',
            category: '$category',
          },
          count: { $sum: 1 },
        },
      },
      // {
      //   $group: {
      //     _id: '$_id.dependency',
      //     states: {
      //       $push: {
      //         state: '$_id.state',
      //         category: '$_id.category',
      //         count: '$count',
      //       },
      //     },
      //     total: { $sum: '$count' },
      //   },
      // },
      // {
      //   $lookup: {
      //     from: 'dependencies',
      //     localField: '_id',
      //     foreignField: '_id',
      //     as: 'dependency',
      //   },
      // },
      // {
      //   $unwind: '$dependency',
      // },
      // {
      //   $project: {
      //     dependency: { name: '$dependency.name', _id: 1 },
      //     states: 1,
      //     total: 1,
      //   },
      // },
    ];
    return await this.procedureModel.aggregate(pipeline);
  }

  async getUnlinkData(account: Account) {
    // await account.populate([
    //   {
    //     path: 'funcionario',
    //     select: 'nombre paterno materno',
    //     populate: { path: 'cargo', select: 'nombre' },
    //   },
    //   {
    //     path: 'dependencia',
    //     select: 'nombre',
    //   },
    // ]);
    // // const inbox = await this.communicationModel
    // //   .find({ 'receiver.cuenta': account._id, status: { $in: [StatusMail.Received, StatusMail.Pending] } })
    // //   .lean()
    // //   .populate('procedure');
    // return { account };
  }

  async getWorkDetails(id_account: string) {
    // return await this.communicationModel
    //   .aggregate()
    //   .match({
    //     'receiver.cuenta': new mongoose.Types.ObjectId(id_account),
    //   })
    //   .group({
    //     _id: '$status',
    //     count: { $sum: 1 },
    //   });
  }

  async getTotalCommunications(id_account: string) {
    // return await this.communicationModel
    //   .aggregate()
    //   .match({
    //     'receiver.cuenta': new mongoose.Types.ObjectId(id_account),
    //   })
    //   .group({
    //     _id: '$status',
    //     count: { $sum: 1 },
    //   });
  }

  async getPendingsByUnit(dependencyId: string) {
    const unit = await this.accountModel.find({ dependencia: dependencyId }, '_id');
    // const results = await this.communicationModel
    //   .aggregate()
    //   .match({ 'receiver.cuenta': { $in: unit.map((account) => account._id) } })
    //   .group({
    //     _id: {
    //       account: '$receiver.cuenta',
    //       status: '$status',
    //     },
    //     count: { $sum: 1 },
    //   })
    //   .group({
    //     _id: '$_id.account',
    //     details: {
    //       $push: {
    //         status: '$_id.status',
    //         total: '$count',
    //       },
    //     },
    //   });
    // return await this.accountModel.populate(results, {
    //   path: '_id',
    //   select: 'funcionario',
    //   populate: {
    //     path: 'funcionario',
    //     select: '-_id nombre paterno materno cargo',
    //     populate: { path: 'cargo', select: 'nombre -_id' },
    //   },
    // });
  }

  async getPendingsByAccount(id_account: string) {
    // return await this.communicationModel
    //   .find({ 'receiver.cuenta': id_account })
    //   .populate('procedure', 'code, reference state');
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model } from 'mongoose';

import { Account, Dependency } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/modules/common';
import { SearchProcedureByApplicantDto, SearchProcedureDto } from './dtos';
import { ExternalProcedure, ExternalProcedureDocument, Procedure, ProcedureDocument } from '../procedures/schemas';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectModel(Dependency.name) private dependencyModel: Model<Dependency>,
    @InjectModel(Procedure.name) private procedureModel: Model<ProcedureDocument>,
    @InjectModel(ExternalProcedure.name) private externalModel: Model<ExternalProcedureDocument>, // @InjectModel(Communication.name) private communicationModel: Model<Communication>,
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
      throw new BadRequestException('Debe proporcionar al menos 2 criterios de búsqueda.');
    }
    
    const [procedures, length] = await Promise.all([
      this.procedureModel.find({ $and: query }).lean().limit(limit).skip(offset),
      this.procedureModel.countDocuments({ $and: query }),
    ]);
    return { procedures, length };
  }

  async searchProcedureByApplicant(dto: SearchProcedureByApplicantDto, { limit, offset }: PaginationDto) {
    const query: FilterQuery<ExternalProcedure> = Object.entries(dto).reduce((acc, [key, value]) => {
      if (key === 'firstname') value = new RegExp(value, 'i');
      acc[`${dto.by}.${key}`] = value;
      return acc;
    }, {});
    if (query.length === 0) throw new BadRequestException('No se ingreso ningun parametro');
    const [procedures, length] = await Promise.all([
      this.externalModel.find(query).lean().limit(limit).skip(offset),
      this.externalModel.countDocuments(query),
    ]);
    return { procedures, length };
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

  async getImboxByAccount(accountId: string) {
    // const inbox = await this.communicationModel
    //   .find({ 'receiver.cuenta': accountId, status: { $in: [StatusMail.Received, StatusMail.Pending] } })
    //   .lean()
    //   .populate('procedure');
    // return inbox;
  }
}

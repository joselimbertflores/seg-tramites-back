import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, PipelineStage, Types } from 'mongoose';

import {
  Procedure,
  ExternalProcedure,
  ProcedureDocument,
  ExternalProcedureDocument,
} from 'src/modules/procedures/schemas';
import { PaginationDto } from 'src/modules/common';
import { SearchProcedureByApplicantDto, SearchProcedureDto, TotalProceduresBySegmentParamsDto } from '../dtos';

@Injectable()
export class ReportProcedureService {
  constructor(
    @InjectModel(Procedure.name) private procedureModel: Model<ProcedureDocument>,
    @InjectModel(ExternalProcedure.name) private externalModel: Model<ExternalProcedureDocument>,
  ) {}

  async getTotalBySegment(params: TotalProceduresBySegmentParamsDto) {
    const { institutionId, startDate, endDate, group } = params;
    startDate.setUTCHours(0, 0, 0, 0);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          institution: new Types.ObjectId(institutionId),
          createdAt: { $gte: startDate, $lte: endDate },
          group,
        },
      },
      {
        $group: {
          _id: {
            prefix: '$prefix',
            status: '$status',
            state: '$state',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.prefix',
          breakdown: {
            $push: {
              state: '$_id.state',
              status: '$_id.status',
              count: '$count',
            },
          },
          total: { $sum: '$count' },
        },
      },
      {
        $addFields: {
          totals: {
            $reduce: {
              input: '$breakdown',
              initialValue: { pending: 0, completed: 0 },
              in: {
                pending: {
                  $cond: [
                    { $eq: ['$$this.status', 'pending'] },
                    { $add: ['$$value.pending', '$$this.count'] },
                    '$$value.pending',
                  ],
                },
                completed: {
                  $cond: [
                    { $eq: ['$$this.status', 'completed'] },
                    { $add: ['$$value.completed', '$$this.count'] },
                    '$$value.completed',
                  ],
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          prefix: '$_id',
          total: 1,
          breakdown: 1,
          totals: 1,
        },
      },
      {
        $sort: { total: -1 },
      },
    ];

    const segments = await this.procedureModel.aggregate(pipeline);

    const globalTotals = segments.reduce(
      (acc, segment) => {
        acc['totalPending'] += segment.totals.pending || 0;
        acc['totalCompleted'] += segment.totals.completed || 0;
        acc['total'] += segment.total;
        return acc;
      },
      { totalPending: 0, totalCompleted: 0, total: 0 },
    );
    return {
      segments,
      globalTotals,
    };
  }

  async searchProcedureByApplicant(filterProps: SearchProcedureByApplicantDto, { limit, offset }: PaginationDto) {
    console.log(filterProps);
    console.log('SEARCH PROCEDURE BY PROPERTIES');
    const { typeProcedure, by, properties } = filterProps;
    const query: mongoose.FilterQuery<ExternalProcedure>[] = [
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

  async searchProcedureByProperties(dto: SearchProcedureDto, { limit, offset }: PaginationDto) {
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
}

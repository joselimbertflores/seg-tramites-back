import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Procedure, ProcedureDocument } from 'src/modules/procedures/schemas';
import { TotalProceduresBySegmentParamsDto } from '../dtos';

@Injectable()
export class ReportProcedureService {
  constructor(@InjectModel(Procedure.name) private procedureModel: Model<ProcedureDocument>) {}

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
    console.log(segments);

    const globalTotals = segments.reduce(
      (acc, segment) => {
        acc.pending += segment.totals.pending || 0;
        acc.completed += segment.totals.completed || 0;
        return acc;
      },
      { pending: 0, completed: 0 },
    );

    return {
      institutionId,
      segments,
      globalTotals,
    };
  }
}

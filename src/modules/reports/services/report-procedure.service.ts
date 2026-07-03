import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, PipelineStage, Types } from 'mongoose';

import {
  Procedure,
  ExternalProcedure,
  ProcedureDocument,
  ExternalProcedureDocument,
  procedureStatus,
} from 'src/modules/procedures/schemas';
import { PaginationDto } from 'src/modules/common';
import {
  GetProceduresEficiencyParamsDto,
  SearchProcedureByApplicantDto,
  SearchProcedureDto,
  TotalProceduresBySegmentParamsDto,
} from '../dtos';
import { addDays, differenceInCalendarDays, isBefore, isWeekend, startOfDay } from 'date-fns';
import { TypeProcedure } from 'src/modules/administration/schemas';

@Injectable()
export class ReportProcedureService {
  constructor(
    @InjectModel(Procedure.name) private procedureModel: Model<ProcedureDocument>,
    @InjectModel(TypeProcedure.name) private procedureTypeModel: Model<TypeProcedure>,
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

  async getProceduresEnficiency(params: GetProceduresEficiencyParamsDto) {
    const { startDate, endDate, institution, segment = 'APR' } = params;

    const from = new Date(startDate);
    from.setUTCHours(0, 0, 0, 0);

    const to = new Date(endDate);
    to.setUTCHours(23, 59, 59, 999);

    const procedureTypes = await this.procedureTypeModel
      .find({
        segmento: segment,
      })
      .select('_id nombre')
      .lean();

    if (!procedureTypes.length) {
      return [];
    }

    const typeIds = procedureTypes.map((type) => type._id);

    const typeNameMap = new Map(procedureTypes.map((type) => [type._id.toString(), type.nombre]));

    type ProcedureResume = {
      id: Types.ObjectId;
      code?: string;
      group?: string;
      createdAt: Date;
      completedAt: Date;
      workingDays: number;
    };

    const resultMap = new Map<
      string,
      {
        typeId: Types.ObjectId;
        typeName: string;
        count: number;
        totalWorkingDays: number;
        minWorkingDays: number;
        maxWorkingDays: number;
        fastestProcedure: ProcedureResume;
        slowestProcedure: ProcedureResume;
      }
    >();

    const cursor = this.externalModel
      .find({
        status: procedureStatus.COMPLETED,
        institution: new Types.ObjectId(institution),
        type: {
          $in: typeIds,
        },
        completedAt: {
          $gte: from,
          $lte: to,
        },
        createdAt: {
          $ne: null,
        },
      })
      .select({
        _id: 1,
        type: 1,
        code: 1,
        group: 1,
        createdAt: 1,
        completedAt: 1,
      })
      .lean()
      .cursor();

    for await (const procedure of cursor) {
      if (!procedure.createdAt || !procedure.completedAt) {
        continue;
      }

      const typeId = procedure.type.toString();
      const typeName = typeNameMap.get(typeId);

      if (!typeName) {
        continue;
      }

      const workingDays = this.calculateWorkingDays(new Date(procedure.createdAt), new Date(procedure.completedAt));

      const procedureResume: ProcedureResume = {
        id: procedure._id,
        code: procedure.code,
        group: procedure.group,
        createdAt: procedure.createdAt,
        completedAt: procedure.completedAt,
        workingDays,
      };

      const current = resultMap.get(typeId);

      if (!current) {
        resultMap.set(typeId, {
          typeId: procedure.type._id,
          typeName,
          count: 1,
          totalWorkingDays: workingDays,
          minWorkingDays: workingDays,
          maxWorkingDays: workingDays,
          fastestProcedure: procedureResume,
          slowestProcedure: procedureResume,
        });

        continue;
      }

      current.count += 1;
      current.totalWorkingDays += workingDays;

      if (workingDays < current.minWorkingDays) {
        current.minWorkingDays = workingDays;
        current.fastestProcedure = procedureResume;
      }

      if (workingDays > current.maxWorkingDays) {
        current.maxWorkingDays = workingDays;
        current.slowestProcedure = procedureResume;
      }
    }

    return Array.from(resultMap.values())
      .map((item) => ({
        typeId: item.typeId,
        typeName: item.typeName,
        count: item.count,
        averageWorkingDays: +(item.totalWorkingDays / item.count).toFixed(2),
        minWorkingDays: item.minWorkingDays,
        maxWorkingDays: item.maxWorkingDays,
        fastestProcedure: item.fastestProcedure,
        slowestProcedure: item.slowestProcedure,
      }))
      .sort((a, b) => b.count - a.count);
  }

  calculateWorkingDays(start: Date, end: Date): number {
    const startDate = startOfDay(start);
    const endDate = startOfDay(end);

    if (isBefore(endDate, startDate)) {
      return 0;
    }

    const totalDays = differenceInCalendarDays(endDate, startDate) + 1;
    const fullWeeks = Math.floor(totalDays / 7);

    let workingDays = fullWeeks * 5;

    const remainingDays = totalDays % 7;
    const firstRemainingDay = addDays(startDate, fullWeeks * 7);

    for (let i = 0; i < remainingDays; i++) {
      const day = addDays(firstRemainingDay, i);

      if (!isWeekend(day)) {
        workingDays++;
      }
    }

    return workingDays;
  }
}

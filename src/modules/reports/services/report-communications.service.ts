import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';

import { Communication, SendStatus } from 'src/modules/communications/schemas';
import {
  GetCommunicationHistoryDto,
  GetCorrespondenceByAccountDto,
  GetTotalCommunicationsByUnit,
  PaginationReportDto,
} from '../dtos';
import { Account } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/modules/common';

@Injectable()
export class ReportCommunicationsService {
  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<Communication>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
  ) {}

  async getTotalByUnit(params: GetTotalCommunicationsByUnit, dependencyId: string) {
    const { startDate, endDate, filterBy, group } = params;
    const unit = await this.accountModel
      .find({ dependencia: dependencyId })
      .populate({ path: 'officer', select: 'nombre paterno materno' })
      .select('officer jobtitle');

    const pipeline: PipelineStage[] = [
      {
        $match: {
          [`${filterBy}.account`]: { $in: unit.map((account) => account._id) },
          sentDate: {
            $gte: startDate,
            $lte: endDate,
          },
          ...(group && { ['procedure.group']: group }),
        },
      },
      // 2. Agrupar por cuenta (funcionario) y estado
      {
        $group: {
          _id: {
            account: `$${filterBy}.account`,
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

  async getCorrespondenceStatusByUnit(params: GetCorrespondenceByAccountDto, defaultDependencyId: string) {
    const { filterBy, dependencyId } = params;

    const unit = await this.accountModel
      .find({ dependencia: dependencyId ?? defaultDependencyId })
      .populate({ path: 'officer', select: 'nombre paterno materno' })
      .select('officer jobtitle');

    const statuses =
      filterBy === 'recipient'
        ? [SendStatus.Pending, SendStatus.Received]
        : [SendStatus.Pending, SendStatus.Rejected, SendStatus.AutoRejected];

    const pipeline: PipelineStage[] = [
      {
        $match: {
          [`${filterBy}.account`]: { $in: unit.map((account) => account._id) },
          status: { $in: statuses },
        },
      },
      {
        $group: {
          _id: {
            account: `$${filterBy}.account`,
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
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

    const result: { statusCounts: { status: SendStatus; count: number }[]; total: 0; _id: string }[] =
      await this.communicationModel.aggregate(pipeline);

    const mapResult = new Map(result.map(({ _id, ...props }) => [String(_id), props]));

    return unit.map((account) => {
      const itemResult = mapResult.get(String(account._id)) || {
        statusCounts: [],
        total: 0,
      };

      return {
        id: account._id,
        fullName: account.officer?.fullName,
        jobTitle: account.jobtitle,
        total: itemResult.total,
        statusCounts: statuses.map((status) => {
          return {
            status,
            count: itemResult.statusCounts.find((item) => item.status === status)?.count ?? 0,
          };
        }),
      };
    });
  }

  async getCorrespondenceByAccount(accountId: string, params: GetCorrespondenceByAccountDto) {
    const { filterBy } = params;
    const statuses =
      filterBy === 'recipient'
        ? [SendStatus.Pending, SendStatus.Received]
        : [SendStatus.Pending, SendStatus.Rejected, SendStatus.AutoRejected];
    return await this.communicationModel
      .find({
        [`${filterBy}.account`]: accountId,
        status: { $in: statuses },
      })
      .lean();
  }

  async getHistory(accountId: string, paginationParams: PaginationReportDto, filterParams: GetCommunicationHistoryDto) {
    console.log(paginationParams);
    const { term, limit, offset, export: isExport } = paginationParams;
    const { startDate, endDate } = filterParams;

    const regex = term ? new RegExp(term, 'i') : undefined;

    const dateRange = this.normalizeDateRange(startDate, endDate);
    console.log(isExport);
    const query: FilterQuery<Communication> = {
      status: SendStatus.Completed,
      'sender.account': accountId,
      ...(regex && {
        $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }],
      }),
      ...(dateRange && { sentDate: dateRange }),
    };
    if (isExport) {
      console.log("todo");
      const communications = await this.communicationModel
        .find(query)
        .populate({ path: 'procedure.ref', select: 'state' })
        .sort({ sentDate: 1 })
        .lean();

      return { communications, length: communications.length };
    }

    const [communications, length] = await Promise.all([
      this.communicationModel
        .find(query)
        .populate({ path: 'procedure.ref', select: 'state' })
        .limit(limit)
        .skip(offset)
        .lean(),
      this.communicationModel.countDocuments(query),
    ]);

    return { communications, length };
  }

  normalizeDateRange(start?: Date, end?: Date) {
    const range: any = {};

    if (start) {
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      range.$gte = startDate;
    }

    if (end) {
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      range.$lte = endDate;
    }

    return Object.keys(range).length ? range : undefined;
  }

  async getUnlinkData(account: Account) {
    const inboxFilter = {
      'recipient.account': account._id,
      status: { $in: [SendStatus.Pending, SendStatus.Received] },
    };

    const outboxFilter = {
      'sender.account': account._id,
      status: { $in: [SendStatus.Pending, SendStatus.AutoRejected] },
    };
    const [inboxItems, outboxItems] = await Promise.all([
      this.communicationModel.find(inboxFilter).sort({ createdAt: 1 }).lean(),

      this.communicationModel.find(outboxFilter).sort({ createdAt: 1 }).lean(),
    ]);

    const inboxSummary = inboxItems.reduce(
      (acc, item) => {
        if (item.status === SendStatus.Pending) acc.pending++;
        if (item.status === SendStatus.Received) acc.received++;
        return acc;
      },
      { pending: 0, received: 0 },
    );
    const outboxSummary = outboxItems.reduce(
      (acc, item) => {
        if (item.status === SendStatus.Pending) acc.pending++;
        if (item.status === SendStatus.AutoRejected) acc.autoRejected++;
        return acc;
      },
      { pending: 0, autoRejected: 0 },
    );
    return {
      officer: {
        fullname: account.officer.fullName,
        jobtitle: account.jobtitle,
        dependency: account.dependencia.nombre,
        institution: account.institution.nombre,
      },
      summary: {
        inbox: inboxSummary,
        outbox: outboxSummary,
      },
      inboxItems,
      outboxItems,
    };
  }

  async getAccountTrayStatus(accountId: string) {
    const inboxStatuses = [SendStatus.Pending, SendStatus.Received];
    const outboxStatuses = [SendStatus.Pending, SendStatus.Rejected, SendStatus.AutoRejected];
    const [inboxResult, outboxResult] = await Promise.all([
      this.communicationModel.aggregate([
        {
          $match: {
            'recipient.account': new Types.ObjectId(accountId),
            status: { $in: inboxStatuses },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      this.communicationModel.aggregate([
        {
          $match: {
            'sender.account': new Types.ObjectId(accountId),
            status: { $in: outboxStatuses },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);
    const formatResult = (data: { _id: SendStatus; count: number }[], statuses: SendStatus[]) => {
      const breakdown = {};
      let total = 0;

      for (const status of statuses) {
        const count = data.find((item) => item._id === status)?.count ?? 0;
        breakdown[status] = count;
        total += count;
      }

      return { total, breakdown };
    };
    return {
      inbox: formatResult(inboxResult, inboxStatuses),
      outbox: formatResult(outboxResult, outboxStatuses),
    };
  }
}

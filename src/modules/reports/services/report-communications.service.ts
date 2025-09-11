import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';

import { Communication, SendStatus } from 'src/modules/communications/schemas';
import { GetCommunicationHistoryDto, GetCorrespondenceStatusByUnit, GetTotalCommunicationsByUnit } from '../dtos';
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

  async getCorrespondenceStatusByUnit(params: GetCorrespondenceStatusByUnit, dependencyId: string) {
    console.log(dependencyId);
    const { filterBy, group } = params;
    const unit = await this.accountModel
      .find({ dependencia: dependencyId })
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
          ...(group && { ['procedure.group']: group }),
          status: { $in: statuses },
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
    result.forEach((item) => console.log(item));
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

  async getHistory(accountId: string, paginationParams: PaginationDto, filterParams: GetCommunicationHistoryDto) {
    const { term, limit, offset } = paginationParams;
    const { startDate, endDate } = filterParams;
    const regex = new RegExp(term, 'i');
    const interval = { ...(startDate && { $gte: startDate }), ...(endDate && { $lte: endDate }) };
    const query: FilterQuery<Communication> = {
      status: SendStatus.Completed,
      'sender.account': accountId,
      ...(term && { $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }] }),
      ...(Object.keys(interval).length > 0 && { sentDate: { $gte: startDate, $lte: endDate } }),
    };
    const [communications, length] = await Promise.all([
      this.communicationModel.find(query).limit(limit).skip(offset).lean(),
      this.communicationModel.count(query),
    ]);
    return { communications, length };
  }

  async getUnlinkData(account: Account) {
    const [inboxData, outboxCounts] = await Promise.all([
      this.communicationModel.aggregate([
        {
          $match: {
            status: { $in: ['pending', 'received'] },
            'recipient.account': account._id,
          },
        },
        {
          $facet: {
            items: [{ $project: { __v: 0 } }],
            counts: [
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]),
      this.communicationModel.aggregate([
        {
          $match: {
            'sender.account': new Types.ObjectId(account.id),
            status: {
              $in: [SendStatus.Pending, SendStatus.Rejected, SendStatus.AutoRejected],
            },
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

    const [{ items = [], counts = [] }] = inboxData;

    const inboxSummary = {
      pending: 0,
      received: 0,
    };
    for (const item of counts) {
      if (item._id === SendStatus.Pending) inboxSummary.pending = item.count;
      if (item._id === SendStatus.Received) inboxSummary.received = item.count;
    }

    const outboxSummary = {
      pending: 0,
      rejected: 0,
      autoRejected: 0,
    };

    for (const item of outboxCounts) {
      if (item._id === SendStatus.Pending) outboxSummary.pending = item.count;
      if (item._id === SendStatus.Rejected) outboxSummary.rejected = item.count;
      if (item._id === SendStatus.AutoRejected) outboxSummary.autoRejected = item.count;
    }

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
      inboxItems: items,
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

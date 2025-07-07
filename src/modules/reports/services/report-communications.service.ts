import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';

import { Communication, CommunicationDocument, communicationStatus } from 'src/modules/communications/schemas';
import { GetCommunicationHistoryDto, GetTotalCommunicationsByUnit } from '../dtos';
import { Account } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/modules/common';

@Injectable()
export class ReportCommunicationsService {
  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
  ) {}

  async getTotalByUnit(params: GetTotalCommunicationsByUnit, dependencyId: string) {
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

  async getHistory(
    accountId: string,
    { limit, offset, term }: PaginationDto,
    { startDate, endDate }: GetCommunicationHistoryDto,
  ) {
    const regex = new RegExp(term, 'i');
    const interval = { ...(startDate && { $gte: startDate }), ...(endDate && { $lte: endDate }) };
    const query: FilterQuery<Communication> = {
      status: communicationStatus.Completed,
      'recipient.account': accountId,
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
            'recipient.account': new Types.ObjectId(account.id),
            status: { $in: [communicationStatus.Received, communicationStatus.Pending] },
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
              $in: [communicationStatus.Pending, communicationStatus.Rejected, communicationStatus.AutoRejected],
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

    const [{ items: inboxItems, counts: inboxCounts }] = inboxData;

    const inboxSummary = {
      pending: 0,
      received: 0,
    };
    for (const item of inboxCounts) {
      if (item._id === communicationStatus.Pending) inboxSummary.pending = item.count;
      if (item._id === communicationStatus.Received) inboxSummary.received = item.count;
    }

    const outboxSummary = {
      pending: 0,
      rejected: 0,
      autoRejected: 0,
    };

    for (const item of outboxCounts) {
      if (item._id === communicationStatus.Pending) outboxSummary.pending = item.count;
      if (item._id === communicationStatus.Rejected) outboxSummary.rejected = item.count;
      if (item._id === communicationStatus.AutoRejected) outboxSummary.autoRejected = item.count;
    }

    return {
      officer: {
        fullname: account.officer.fullName,
        jobtitle: account.jobtitle,
        dependency: account.dependencia.nombre,
        user: account.user.login,
      },
      summary: {
        inbox: inboxSummary,
        outbox: outboxSummary,
      },
      inboxItems,
    };
  }
}

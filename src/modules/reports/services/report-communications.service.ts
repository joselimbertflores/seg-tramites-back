import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';

import { Communication, CommunicationDocument } from 'src/modules/communications/schemas';
import { Account } from 'src/modules/administration/schemas';
import { GetTotalCommunicationsByUnit } from '../dtos';

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
}

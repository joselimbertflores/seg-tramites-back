import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { Model } from 'mongoose';
import { isWeekend, subDays } from 'date-fns';

import { EnvVars } from 'src/config';
import { Communication, SendStatus } from '../communications/schemas';

@Injectable()
export class SchedulerService {
  private readonly AUTO_REJECT_DAYS = this.configService.get<number>('AUTO_REJECT_DAYS');

  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<Communication>,
    private configService: ConfigService<EnvVars>,
  ) {}

  @Cron('0 3 * * 1-5')
  async autoRejectExpiredCommunications() {
    const expirationDate = this.calculateBusinessDaysDeadline(this.AUTO_REJECT_DAYS);
    const ids = await this.communicationModel.aggregate([
      {
        $match: {
          status: SendStatus.Pending,
          sentDate: { $lte: expirationDate },
        },
      },
      {
        $lookup: {
          from: 'cuentas',
          localField: 'sender.account',
          foreignField: '_id',
          as: 'senderAccount',
        },
      },
      { $unwind: '$senderAccount' },
      {
        $match: {
          'senderAccount.officer': { $ne: null },
        },
      },
      { $project: { _id: 1 } },
    ]);

    const chunkSize = 1000;

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await this.communicationModel.bulkWrite(
        chunk.map(({ _id }) => ({
          updateOne: {
            filter: { _id },
            update: { $set: { status: SendStatus.AutoRejected } },
          },
        })),
      );
    }
  }

  calculateBusinessDaysDeadline(daysLimit: number): Date {
    let date = new Date();
    let remainingDays = daysLimit;
    while (remainingDays > 0) {
      date = subDays(date, 1);
      if (!isWeekend(date)) remainingDays--;
    }
    return date;
  }
}

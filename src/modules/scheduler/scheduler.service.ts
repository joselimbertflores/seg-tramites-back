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
    await this.communicationModel.updateMany(
      { status: SendStatus.Pending, sentDate: { $lte: expirationDate } },
      { $set: { status: SendStatus.AutoRejected } },
    );
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

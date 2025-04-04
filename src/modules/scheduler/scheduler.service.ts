import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { Model, Connection } from 'mongoose';

import { EnvVars } from 'src/config';
import { Communication, CommunicationDocument, communicationStatus } from '../communications/schemas';
import { subBusinessDays } from 'date-fns';

@Injectable()
export class SchedulerService {
  private readonly autoRejectHours = this.configService.get<number>('AUTO_REJECT_HOURS');

  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
    @InjectConnection() private connection: Connection,
    private configService: ConfigService<EnvVars>,
  ) {}

  @Cron('0 3 * * *')
  async autoRejectExpiredCommunications() {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const now = new Date();

      // const expirationTime = new Date(now.getTime() - this.autoRejectHours * 60 * 60 * 1000);
      const expirationTime = this.subtractBusinessHours(now, this.autoRejectHours);

      await this.communicationModel.updateMany(
        { status: communicationStatus.Pending, sentDate: { $lte: expirationTime } },
        { $set: { status: communicationStatus.AutoRejected } },
        { session },
      );
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  private subtractBusinessHours(startDate: Date, totalHours: number): Date {
    const result = new Date(startDate);

    while (totalHours > 0) {
      result.setHours(result.getHours() - 1);

      const day = result.getDay();
      if (day >= 1 && day <= 5) {
        totalHours--;
      }
    }

    return result;
  }
}

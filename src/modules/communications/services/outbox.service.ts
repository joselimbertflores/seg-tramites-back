import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import { Connection, Model } from 'mongoose';
import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { EnvVars } from 'src/config';

@Injectable()
export class OutboxService {
  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
    @InjectConnection() private connection: Connection,
    private configService: ConfigService<EnvVars>,
  ) {}

  @Cron('0 3 * * *')
  private async autoRejectExpiredCommunications() {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const autoRejectHours = this.configService.get<number>('AUTO_REJECT_HOURS');

      const now = new Date();

      const expirationTime = new Date(now.getTime() - autoRejectHours * 60 * 60 * 1000);

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
}

import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { ClientSession, Connection, FilterQuery, Model } from 'mongoose';

import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { Account } from 'src/modules/administration/schemas';
import { Procedure, procedureState } from 'src/modules/procedures/schemas';

import { PaginationDto } from 'src/modules/common';
import { EnvVars } from 'src/config';
import { SelectedCommunicationsDto } from '../dtos';

@Injectable()
export class OutboxService {
  private readonly autoRejectHours = this.configService.get<number>('AUTO_REJECT_HOURS');

  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
    @InjectConnection() private connection: Connection,
    private configService: ConfigService<EnvVars>,
  ) {}

  async findAll(accountId: string, { limit, offset, term }: PaginationDto) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<Communication> = {
      'sender.account': accountId,
      status: { $in: [communicationStatus.Pending, communicationStatus.Rejected, communicationStatus.AutoRejected] },
      ...(term && { $or: [{ 'procedure.code': regex }, { 'recipient.fullname': regex }] }),
    };
    const [communications, length] = await Promise.all([
      this.communicationModel.find(query).skip(offset).limit(limit).sort({ sentDate: 'descending' }),
      this.communicationModel.count(query),
    ]);
    return { communications: this.plainCommunications(communications), length };
  }

  async cancel(account: Account, { communicationIds }: SelectedCommunicationsDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const documents = await this.communicationModel
        .find({ _id: { $in: communicationIds } }, null, { session })
        .populate('recipient.account');

      const isReceived = documents.find(({ status }) => status !== communicationStatus.Pending);
      if (isReceived) {
        throw new BadRequestException(`${isReceived.recipient.fullname} ya ha evaluado el tramite`);
      }
      await this.communicationModel.deleteMany({ _id: { $in: communicationIds } }, { session });
      const originalDocuments = documents.filter(({ isOriginal }) => isOriginal);
      for (const communication of originalDocuments) {
        await this._restoreStage(communication, account, session);
      }
      await session.commitTransaction();
      return documents.map(({ _id, recipient }) => ({
        toUser: String(recipient.account.user._id),
        communicationId: String(_id),
      }));
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Ha ocurrido un error al cancelar');
    } finally {
      await session.endSession();
    }
  }

  private plainCommunications(communications: CommunicationDocument[]) {
    return communications.map((item) => ({
      ...item.toObject(),
      expirationDate: new Date(item.sentDate.getTime() + this.autoRejectHours * 60 * 60 * 1000),
    }));
  }

  private async _restoreStage(
    { procedure, isOriginal }: Communication,
    currentEmitter: Account,
    session: ClientSession,
  ): Promise<void> {
    if (!isOriginal) return;
    const lastStage = await this.communicationModel.findOne(
      {
        procedure: procedure.ref._id,
        'recipient.cuenta': currentEmitter._id,
        status: { $in: [communicationStatus.Completed, communicationStatus.Received] },
      },
      null,
      { sort: { _id: -1 }, session },
    );
    if (lastStage) {
      await this.communicationModel.updateOne(
        { _id: lastStage._id },
        { status: communicationStatus.Received },
        { session },
      );
    } else {
      await this.procedureModel.updateOne({ _id: procedure.ref._id }, { state: procedureState.INSCRITO }, { session });
    }
  }

  @Cron('0 3 * * *')
  private async autoRejectExpiredCommunications() {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const now = new Date();

      const expirationTime = new Date(now.getTime() - this.autoRejectHours * 60 * 60 * 1000);

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

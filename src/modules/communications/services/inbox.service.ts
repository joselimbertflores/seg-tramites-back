import {
  Injectable,
  HttpException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';

import { Connection, FilterQuery, Model } from 'mongoose';

import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { Account } from 'src/modules/administration/schemas';
import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';

type skippedItem = {
  id: string;
  status?: string;
  reason: string;
};

type bulkActionResponse = {
  updatedIds: string[];
  skipped: skippedItem[];
};

@Injectable()
export class InboxService {
  constructor(
    @InjectModel(Communication.name) private inboxModel: Model<CommunicationDocument>,
    @InjectConnection() private connection: Connection,
    private configService: ConfigService,
  ) {}

  async findAll(accountId: string, filterDto: FilterInboxDto) {
    const { limit, offset, isOriginal, status, term, group } = filterDto;
    const regex = new RegExp(filterDto.term, 'i');
    const filterQuery: FilterQuery<Communication> = {
      'recipient.account': accountId,
      ...(status ? { status } : { status: { $in: [communicationStatus.Received, communicationStatus.Pending] } }),
      ...(term && { $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }] }),
      ...(group && { 'procedure.group': filterDto.group }),
      ...(typeof isOriginal === 'boolean' && {
        ...(isOriginal ? { isOriginal } : { isOriginal: { $in: [false, null] } }),
      }),
    };
    const [communications, length] = await Promise.all([
      this.inboxModel.find(filterQuery).limit(limit).skip(offset).sort({ sentDate: -1 }),
      this.inboxModel.countDocuments(filterQuery),
    ]);
    return { communications, length };
  }

  async accept({ ids }: SelectedCommunicationsDto): Promise<bulkActionResponse> {
    const { valid, invalid, notFoundIds } = await this.filterPendingCommunications(ids);
    if (notFoundIds) {
      throw new NotFoundException({ message: 'Some selected elements dont exist', notFoundIds });
    }
    const validIds = valid.map(({ id }) => id);
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      await this.inboxModel.updateMany(
        { _id: { $in: validIds } },
        { status: communicationStatus.Received, receivedDate: new Date() },
        { session },
      );
      await session.commitTransaction();

      return {
        updatedIds: validIds,
        skipped: invalid.map(({ id, status }) => ({ id, status, reason: `Invalid status` })),
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async reject(account: Account, { description, ids }: RejectCommunicationDto) {
    const { valid, invalid, notFoundIds } = await this.filterPendingCommunications(ids);

    await this.inboxModel.populate(valid, { path: 'sender.account', select: 'officer' });

    const validIds = valid.filter(({ sender }) => sender.account.officer).map(({ id }) => id);

    const withoutSender = valid
      .filter(({ sender }) => !sender.account.officer)
      .map(({ _id, status }) => ({ _id, status }));

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const currentDate = new Date();
      await this.inboxModel.updateMany(
        { _id: { $in: validIds } },
        {
          status: communicationStatus.Rejected,
          actionLog: { fullname: account.officer.fullName, date: currentDate, description },
          receivedDate: currentDate,
        },
        { session },
      );
      await session.commitTransaction();
      return {
        updatedIds: validIds,
        skipped: [
          ...invalid.map(({ _id, status }) => ({ id: _id, status, reason: `Invalid status: ${status}` })),
          ...withoutSender.map((item) => ({ ...item, reason: 'Missing sender officer' })),
        ],
        notFoundIds: notFoundIds,
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async getOne(id: string, account: Account) {
    const communication = await this.inboxModel.findById(id);
    if (!communication) throw new BadRequestException(`Communication ${id} don't exist`);
    if (account.id !== String(communication.recipient.account._id)) {
      throw new ForbiddenException('Unauthorized to access this communication');
    }
    return communication;
  }

  async getWorkflow(procedureId: string) {
    return await this.inboxModel.find({ 'procedure.ref': procedureId });
  }

  private async filterPendingCommunications(ids: string[]) {
    const items = await this.inboxModel
      .find({ _id: { $in: ids } })
      .populate({ path: 'sender.account', select: 'officer' });

    const foundIds = new Set(items.map((item) => item.id));

    return {
      valid: items.filter(({ status }) => status === communicationStatus.Pending),
      invalid: items.filter(({ status }) => status !== communicationStatus.Pending),
      notFoundIds: ids.filter((id) => !foundIds.has(id)),
    };
  }
}

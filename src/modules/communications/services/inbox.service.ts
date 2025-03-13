import {
  Injectable,
  HttpException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';

import { Connection, FilterQuery, Model } from 'mongoose';

import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { Account } from 'src/modules/administration/schemas';
import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';

@Injectable()
export class InboxService {
  private readonly AUTO_REJECT_HOURS = this.configService.get<number>('AUTO_REJECT_HOURS');
  private readonly AUTO_REJECT_MILISECONDS = this.AUTO_REJECT_HOURS * 60 * 60 * 1000;

  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
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
      ...(isOriginal !== undefined && { isOriginal }),
      ...(group && { 'procedure.group': filterDto.group }),
    };
    const [communications, length] = await Promise.all([
      this.communicationModel.find(filterQuery).limit(limit).skip(offset).sort({ sentDate: -1 }),
      this.communicationModel.count(filterQuery),
    ]);
    return { communications, length };
  }

  async accept({ ids }: SelectedCommunicationsDto) {
    const communications = await this.getValidCommunications(ids);
    const communidationIds = communications.map(({ id }) => id);

    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      await this.communicationModel.updateMany(
        { _id: { $in: communidationIds } },
        { status: communicationStatus.Received, receivedDate: new Date() },
        { session },
      );

      await session.commitTransaction();

      return communidationIds;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async reject(account: Account, { description, ids }: RejectCommunicationDto) {
    const communications = await this.getValidCommunications(ids);

    await this.communicationModel.populate(communications, { path: 'sender.account', select: 'officer' });
    const invalid = communications.find(({ sender }) => !sender.account.officer);

    if (invalid) {
      throw new BadRequestException( `El tramite ${invalid.procedure.code} no puede rechazarse. El emisor ha sido deshabilitado`);
    }
    const communidationIds = communications.map(({ id }) => id);
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const currentDate = new Date();
      await this.communicationModel.updateMany(
        { _id: { $in: communidationIds } },
        {
          status: communicationStatus.Rejected,
          actionLog: { fullname: account.officer.fullName, date: currentDate, description },
          receivedDate: currentDate,
        },
        { session },
      );
      await session.commitTransaction();
      return communidationIds;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async getOne(id: string, account: Account) {
    const communication = await this.communicationModel.findById(id);
    if (!communication) throw new BadRequestException(`Communication ${id} don't exist`);
    if (account.id !== String(communication.recipient.account._id)) {
      throw new ForbiddenException('Unauthorized to access this communication');
    }
    return communication;
  }

  async getWorkflow(procedureId: string) {
    return await this.communicationModel.find({ 'procedure.ref': procedureId });
  }


  private async getValidCommunications(ids: string[]) {
    const items = await this.communicationModel.find({ _id: { $in: ids } });

    const toRemove: string[] = items.filter((item) => item.status !== communicationStatus.Pending).map(({ id }) => id);

    const foundIds = new Set(items.map((item) => item.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    toRemove.push(...missingIds);

    const expiredIds: string[] = items
      .filter(({ status }) => status === communicationStatus.Pending)
      .filter((item) => this.isExpired(item))
      .map(({ id }) => id);

    if (expiredIds.length > 0) {
      toRemove.push(...expiredIds);
      await this.communicationModel.updateMany(
        { _id: { $in: expiredIds } },
        { status: communicationStatus.AutoRejected },
      );
    }
    if (toRemove.length > 0) {
      throw new ConflictException({
        message: 'Algunos envíos ya fueron aceptados o han expirado.',
        toRemove,
      });
    }
    return items;
  }

  private isExpired({ sentDate }: Communication) {
    const now = new Date();
    const expirationTime = sentDate.getTime() + this.AUTO_REJECT_MILISECONDS;
    const remainingTimeInMilliseconds = expirationTime - now.getTime();
    return remainingTimeInMilliseconds <= 0;
  }
}

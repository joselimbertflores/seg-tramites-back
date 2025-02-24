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

import { Account } from 'src/modules/administration/schemas';
import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { DocumentService } from '../../procedures/services/document.service';
import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';

@Injectable()
export class InboxService {
  private readonly AUTO_REJECT_HOURS = this.configService.get<number>('AUTO_REJECT_HOURS');
  private readonly AUTO_REJECT_HOURS_MILISECONDS = this.AUTO_REJECT_HOURS * 60 * 60 * 1000;

  constructor(
    @InjectModel(Communication.name) private communicationModel: Model<CommunicationDocument>,
    @InjectConnection() private connection: Connection,
    private docService: DocumentService,
    private configService: ConfigService,
  ) {}

  async findAll(accountId: string, filterDto: FilterInboxDto) {
    const { limit, offset, isOriginal, status, term, group } = filterDto;
    const regex = new RegExp(filterDto.term, 'i');
    const filterQuery: FilterQuery<Communication> = {
      'recipient.account': accountId,
      ...(status ? { status } : { status: { $in: [communicationStatus.Received, communicationStatus.Pending] } }),
      ...(term && { $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }] }),
      ...(isOriginal !== undefined && { isOriginal: isOriginal }),
      ...(group && { 'procedure.group': filterDto.group }),
    };
    const [communications, length] = await Promise.all([
      this.communicationModel.find(filterQuery).limit(limit).skip(offset).sort({ sentDate: -1 }),
      this.communicationModel.count(filterQuery),
    ]);
    return { communications, length };
  }

  async accept({ communicationIds }: SelectedCommunicationsDto) {
    const communications = await this.getValidCommunications(communicationIds);
    const ids = communications.map(({ id }) => id);

    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      await this.communicationModel.updateMany(
        { _id: { $in: ids } },
        { status: communicationStatus.Received, receivedDate: new Date() },
        { session },
      );

      await session.commitTransaction();

      return ids;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async reject(account: Account, { description, communicationIds }: RejectCommunicationDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const documents = await this.communicationModel.find({ _id: { $in: communicationIds } }, null, { session });
      const isInvalid = documents.find(({ status }) => status !== communicationStatus.Pending);
      if (isInvalid) {
        throw new BadRequestException(`Invalid: ${isInvalid._id}, state is ${isInvalid.status}`);
      }
      const currentDate = new Date();
      await this.communicationModel.updateMany(
        { _id: { $in: communicationIds } },
        {
          receivedDate: currentDate,
          status: communicationStatus.Rejected,
          actionLog: { fullname: account.officer.fullName, date: currentDate, description },
        },
        { session },
      );
      await session.commitTransaction();
      return { message: 'Tramite rechazado' };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      await session.endSession();
    }
  }

  async getOne(communicationId: string, account: Account) {
    const communicationDb = await this.communicationModel.findById(communicationId).populate('procedure');
    if (!communicationDb) throw new BadRequestException(`Communication ${communicationId} don't exist`);
    if (String(account._id) !== String(communicationDb.recipient.account._id)) {
      throw new ForbiddenException('Unauthorized to access this communication');
    }
    return communicationDb;
  }

  async getWorkflow(procedureId: string) {
    return await this.communicationModel.find({ procedure: procedureId });
  }

  private isExpired({ sentDate }: Communication) {
    const now = new Date();
    const expirationTime = sentDate.getTime() + this.AUTO_REJECT_HOURS_MILISECONDS;
    const remainingTimeInMilliseconds = expirationTime - now.getTime();
    return remainingTimeInMilliseconds <= 0;
  }

  private async getValidCommunications(ids: string[]) {
    const items = await this.communicationModel.find({ _id: { $in: ids } });
    const toUpdated: string[] = [];
    const toRemove: string[] = [];

    const foundIds = new Set(items.map((item) => item.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    toRemove.push(...missingIds);

    for (const item of items) {
      switch (item.status) {
        case communicationStatus.Received:
          toUpdated.push(item.id);
          break;

        case communicationStatus.Pending:
          if (this.isExpired(item)) {
            toRemove.push(item.id);
          }
          break;

        default:
          toRemove.push(item.id);
          break;
      }
    }

    if (toRemove.length > 0 || toUpdated.length > 0) {
      throw new ConflictException({
        message: 'Algunos envíos ya fueron aceptados o han expirado.',
        toRemove,
        toUpdated,
      });
    }
    return items;
  }
}

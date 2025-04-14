import {
  Injectable,
  HttpException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';

import { Connection, FilterQuery, Model } from 'mongoose';

import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';
import { Account } from 'src/modules/administration/schemas';

@Injectable()
export class InboxService {
  constructor(
    @InjectModel(Communication.name) private inboxModel: Model<CommunicationDocument>,
    @InjectConnection() private connection: Connection,
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

  async accept(account: Account, { ids }: SelectedCommunicationsDto) {
    const items = await this.getSelectedCommunications(ids, account);

    const currentDate = new Date();

    await this.inboxModel.updateMany(
      { _id: { $in: items.map((item) => item.id) } },
      { status: communicationStatus.Received, receivedDate: currentDate },
    );
    return {
      receivedDate: currentDate,
      items: items.map(({ _id }) => String(_id)),
    };
  }

  async reject(account: Account, { description, ids }: RejectCommunicationDto) {
    const items = await this.getSelectedCommunications(ids, account);

    const validPendings = items.filter(
      ({ sender, status }) => sender.account.officer && status === communicationStatus.Pending,
    );

    const currentDate = new Date();

    await this.inboxModel.updateMany(
      { _id: { $in: validPendings.map(({ id }) => id) } },
      {
        status: communicationStatus.Rejected,
        actionLog: { fullname: account.officer.fullName, date: currentDate, description },
        receivedDate: currentDate,
      },
    );
    return {
      success: validPendings.map(({ id }) => ({ id, date: currentDate })),
      skipped: [
        ...items
          .filter((item) => item.status !== communicationStatus.Pending || !item.sender.account.officer)
          .map(({ id, procedure, status }) => ({
            id,
            reason:
              status !== 'pending'
                ? `El estado del tramite ${procedure.code} es invalido`
                : `El remitente del tramite ${procedure.code} ya no esta disponible`,
          })),
      ],
    };
  }

  private async getSelectedCommunications(ids: string[], account: Account) {
    const items = await this.inboxModel
      .find({ _id: { $in: ids } })
      .populate({ path: 'sender.account', select: 'officer' });

    const foundIds = new Set(items.map((item) => item.id));

    const notFoundIds = ids.filter((id) => !foundIds.has(id));

    if (notFoundIds.length > 0) {
      throw new NotFoundException({ message: 'Some elements dont exist', ids: notFoundIds });
    }

    if (items.some(({ recipient }) => String(recipient.account._id) !== String(account._id))) {
      throw new ForbiddenException('Unauthorized to access this communication');
    }

    return items;
  }

  private checkInvalidItemByStatus(items: CommunicationDocument[], validStatus: communicationStatus) {
    const invalid = items.filter(({ status }) => status !== validStatus);
    if (invalid.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Algunos trámites no se pueden aceptar',
        details: invalid.map(({ id, procedure }) => ({
          id,
          reason: `El estado del tramite ${procedure.code} es invalido`,
        })),
      });
    }
    return items;
  }
}

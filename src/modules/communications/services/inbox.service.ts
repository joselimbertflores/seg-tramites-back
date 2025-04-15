import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { FilterQuery, Model } from 'mongoose';

import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';
import { Communication, CommunicationDocument, communicationStatus } from '../schemas';
import { Account } from 'src/modules/administration/schemas';

@Injectable()
export class InboxService {
  constructor(@InjectModel(Communication.name) private inboxModel: Model<CommunicationDocument>) {}

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
    this.verifyRecipientAccess(communication, account);
    return communication;
  }

  async getWorkflow(procedureId: string) {
    return await this.inboxModel.find({ 'procedure.ref': procedureId });
  }

  async accept(account: Account, { ids }: SelectedCommunicationsDto) {
    const items = await this.getValidatedCommunications(ids, account, communicationStatus.Pending);

    const itemIds = items.map((item) => item.id);

    const currentDate = new Date();

    await this.inboxModel.updateMany(
      { _id: { $in: itemIds } },
      { status: communicationStatus.Received, receivedDate: currentDate },
    );
    return { date: currentDate, itemIds, message: `Received communications: ${itemIds.length}` };
  }

  async reject(account: Account, { description, ids }: RejectCommunicationDto) {
    const items = await this.getValidatedCommunications(ids, account, communicationStatus.Pending);

    const currentDate = new Date();

    const itemIds = items.map((item) => item.id);

    await this.inboxModel.updateMany(
      { _id: { $in: itemIds } },
      {
        status: communicationStatus.Rejected,
        actionLog: { fullname: account.officer.fullName, date: currentDate, description },
        receivedDate: currentDate,
      },
    );
    return { date: currentDate, ids: itemIds, message: `Rejected communications: ${ids.length}` };
  }

  async getValidatedCommunications(ids: string[], account: Account, expectedStatus: communicationStatus) {
    const communications = await this.inboxModel
      .find({ _id: { $in: ids } })
      .populate({ path: 'sender.account', select: 'officer' });

    const foundIds = new Set(communications.map((item) => item.id));

    const notFoundIds = ids.filter((id) => !foundIds.has(id));

    if (notFoundIds.length > 0) {
      throw new NotFoundException({ message: 'Some elements dont exist', notFoundIds });
    }

    communications.forEach((comm) => this.verifyRecipientAccess(comm, account));

    return this.validateStatusOrThrow(communications, expectedStatus);
  }

  private verifyRecipientAccess({ id, recipient }: CommunicationDocument, account: Account) {
    if (String(account._id) !== String(recipient.account._id)) {
      throw new ForbiddenException({ message: 'Unauthorized to access this communication', id });
    }
  }

  private validateStatusOrThrow(communications: CommunicationDocument[], validStatus: communicationStatus) {
    const invalidItems = communications
      .filter(({ status }) => status !== validStatus)
      .map(({ id, procedure: { code }, status }) => ({ id, status, code }));

    if (invalidItems.length > 0) {
      throw new UnprocessableEntityException({
        message: `Some items do not have the expected status: ${validStatus}`,
        invalidItems,
      });
    }
    return communications;
  }
}

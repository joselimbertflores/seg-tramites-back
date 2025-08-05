import { Injectable, NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model } from 'mongoose';

import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';
import { Procedure, procedureState, procedureStatus } from 'src/modules/procedures/schemas';
import { Account } from 'src/modules/administration/schemas';
import { Communication, SendStatus } from '../schemas';

interface archiveCommunicationsProps {
  date: Date;
  ids: string[];
  account: Account;
  description: string;
  state: procedureState;
  session: ClientSession;
}
@Injectable()
export class InboxService {
  constructor(
    @InjectModel(Communication.name) private inboxModel: Model<Communication>,
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
  ) {}

  async findAll(accountId: string, filterDto: FilterInboxDto) {
    const { limit, offset, isOriginal, status, term, group } = filterDto;
    const filterQuery: FilterQuery<Communication> = {
      'recipient.account': accountId,
      status: status ?? { $in: [SendStatus.Received, SendStatus.Pending] },
    };

    if (term) {
      const regex = new RegExp(term, 'i');
      filterQuery.$or = [{ 'procedure.code': regex }, { 'procedure.reference': regex }];
    }

    if (group) {
      filterQuery['procedure.group'] = group;
    }

    if (typeof isOriginal === 'boolean') {
      filterQuery.isOriginal = isOriginal ? true : { $in: [false, null] };
    }

    const [communications, length] = await Promise.all([
      this.inboxModel.find(filterQuery).lean().limit(limit).skip(offset).sort({ priority: 'desc', sentDate: 'desc' }),
      this.inboxModel.countDocuments(filterQuery),
    ]);
    return { communications, length };
  }

  async getOne(id: string, account: Account) {
    const communication = await this.inboxModel.findById(id).lean();
    if (!communication) throw new NotFoundException(`Communication ${id} not found`);
    if (String(account._id) !== String(communication.recipient.account._id)) {
      throw new ForbiddenException({ message: 'Unauthorized to access this communication', id });
    }
    return communication;
  }

  async getWorkflow(procedureId: string) {
    return await this.inboxModel
      .find({ 'procedure.ref': procedureId })
      .populate([
        {
          path: 'sender.dependency',
          select: 'nombre',
        },
        {
          path: 'sender.institution',
          select: 'nombre',
        },
        {
          path: 'recipient.dependency',
          select: 'nombre',
        },
        {
          path: 'recipient.institution',
          select: 'nombre',
        },
      ])
      .lean();
  }

  async accept(account: Account, { ids }: SelectedCommunicationsDto) {
    const items = await this.getValidatedCommunications(ids, account, SendStatus.Pending);

    const itemIds = items.map((item) => item.id);

    const currentDate = new Date();

    await this.inboxModel.updateMany(
      { _id: { $in: itemIds } },
      { status: SendStatus.Received, receivedDate: currentDate },
    );
    return { date: currentDate, ids: itemIds, message: `Received communications: ${itemIds.length}` };
  }

  async reject(account: Account, { description, ids }: RejectCommunicationDto) {
    const items = await this.getValidatedCommunications(ids, account, SendStatus.Pending);

    const currentDate = new Date();

    const itemIds = items.map((item) => item.id);

    await this.inboxModel.updateMany(
      { _id: { $in: itemIds } },
      {
        status: SendStatus.Rejected,
        actionLog: { fullname: account.officer.fullName, date: currentDate, description },
        receivedDate: currentDate,
      },
    );
    return { date: currentDate, ids: itemIds, message: `Rejected communications: ${ids.length}` };
  }

  async archive({ ids, date, state, account, description, session }: archiveCommunicationsProps) {
    const items = await this.getValidatedCommunications(ids, account, SendStatus.Received);
    await this.inboxModel.updateMany(
      { _id: { $in: items.map((item) => item._id) } },
      {
        status: SendStatus.Archived,
        actionLog: { fullname: account.officer.fullName, description, date },
      },
      { session },
    );
    // * For old Schema, isOriginal is undefined
    const originals = items.filter((item) => item.isOriginal !== false);
    const affectedProcedureIds = [...new Set(originals.map(({ procedure }) => String(procedure.ref._id)))];

    if (affectedProcedureIds.length > 0) {
      await this.procedureModel.updateMany(
        { _id: { $in: affectedProcedureIds } },
        { completedAt: date, status: procedureStatus.COMPLETED, state },
        { session },
      );
    }
    return items;
  }

  private async getValidatedCommunications(ids: string[], account: Account, expectedStatus: SendStatus) {
    const communications = await this.inboxModel
      .find({ _id: { $in: ids }, 'recipient.account': account._id })
      .populate({ path: 'sender.account', select: 'officer' });

    const foundIds = new Set(communications.map((item) => item.id));

    const notFoundIds = ids.filter((id) => !foundIds.has(id));

    if (notFoundIds.length > 0) {
      throw new NotFoundException({ message: `Some elements with recipient ${account._id} not found`, notFoundIds });
    }

    return this.validateStatusOrThrow(communications, expectedStatus);
  }

  private validateStatusOrThrow(communications: Communication[], validStatus: SendStatus) {
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

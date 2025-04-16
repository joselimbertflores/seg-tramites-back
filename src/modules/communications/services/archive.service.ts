import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';

import mongoose, { ClientSession, FilterQuery, Model } from 'mongoose';

import { Procedure, procedureState, procedureStatus } from 'src/modules/procedures/schemas';
import { Account } from 'src/modules/administration/schemas';

import {
  Folder,
  Archive,
  Communication,
  FolderDocument,
  ArchiveDocument,
  communicationStatus,
  CommunicationDocument,
} from '../schemas';
import { CreateArchiveDto, FilterArchiveDto, SelectedArchivesDto } from '../dtos';
import { InboxService } from './inbox.service';

interface buildArchiveInstanteProps {
  item: CommunicationDocument;
  account: Account;
  folder: Folder | null;
  description: string;
}

interface archiveCommunicationsProps {
  date: Date;
  ids: string[];
  account: Account;
  description: string;
  state: procedureState;
  session: ClientSession;
}
@Injectable()
export class ArchiveService {
  constructor(
    @InjectConnection() private connection: mongoose.Connection,
    @InjectModel(Folder.name) private folderModel: Model<FolderDocument>,
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
    @InjectModel(Archive.name) private archiveModel: Model<ArchiveDocument>,
    @InjectModel(Communication.name) private communicationModel: Model<Communication>,
    private inboxService: InboxService,
  ) {}

  async findAll({ limit, offset, term, folder }: FilterArchiveDto, account: Account) {
    const regex = new RegExp(term, 'i');
    let folderDB: null | FolderDocument = null;
    if (folder) {
      folderDB = await this.folderModel.findById(folder, { name: 1 });
      if (!folderDB) throw new BadRequestException(`La carpeta ${folder} no existe`);
    }
    const query: FilterQuery<Archive> = {
      dependency: account.dependencia,
      ...(folderDB && { folder: folderDB.id }),
      ...(term && { $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }] }),
    };
    const [archives, length] = await Promise.all([
      this.archiveModel.find(query).limit(limit).skip(offset).sort({ createdAt: -1 }),
      this.archiveModel.count(query),
    ]);
    return { archives, length, ...(folderDB && { folderName: folderDB.name }) };
  }

  async create(account: Account, archiveDto: CreateArchiveDto) {
    const { ids, folderId, description, state } = archiveDto;

    const folder = folderId ? await this.folderModel.findById(folderId) : null;
    if (folderId && !folder) {
      throw new BadRequestException(`El folder ${folderId} no existe`);
    }

    const date = new Date();

    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      const items = await this.archiveCommunications({ ids, session, description, state, account, date });

      const models = items.map((item) => this.buildCommunicationInstance({ item, description, account, folder }));

      await this.archiveModel.insertMany(models, { session });

      await session.commitTransaction();

      return { message: `Archived communications: ${items.length}`, itemIds: items.map((item) => item.id) };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(`Error archive communications`);
    } finally {
      session.endSession();
    }
  }

  async unarchive({ ids }: SelectedArchivesDto, account: Account) {
    const archives = await this.getValidArchives(ids, account);
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const communications = archives.map(({ communication }) => communication);
      await this.communicationModel.updateMany(
        { _id: { $in: communications.map(({ _id }) => _id) } },
        { status: communicationStatus.Received, $unset: { actionLog: 1 } },
        { session },
      );
      const originals = communications.filter(({ isOriginal }) => isOriginal !== false);
      if (originals.length > 0) {
        await this.procedureModel.updateMany(
          { _id: { $in: communications.map(({ procedure }) => procedure.ref._id) } },
          { state: procedureState.EN_REVISION, status: procedureStatus.PENDING, $unset: { completedAt: 1 } },
          { session },
        );
      }
      await this.archiveModel.deleteMany({ _id: { $in: archives.map(({ _id }) => _id) } }, { session });
      await session.commitTransaction();
      return { message: 'Tramites desarchivados correctamente' };
    } catch (error) {
      await session.abortTransaction();
      throw new InternalServerErrorException('Error al desarchivar tramite');
    } finally {
      session.endSession();
    }
  }

  private async getValidArchives(ids: string[], account: Account) {
    const archives = await this.archiveModel.find({ _id: { $in: ids } }).populate('communication');

    const foundIds = new Set(archives.map((item) => item.id));

    const missingId = ids.find((id) => !foundIds.has(id));
    if (missingId) {
      throw new BadRequestException(`El elemento ${missingId} ya fue desarchivado`);
    }

    const invalidArchive = archives.some((item) => String(item.account._id) !== String(account._id));

    if (invalidArchive) {
      throw new BadRequestException(`No puede desarchivar tramites de otros funcionarios`);
    }
    return archives;
  }

  private async archiveCommunications({ ids, date, state, session, account, description }: archiveCommunicationsProps) {
    const items = await this.inboxService.getValidatedCommunications(ids, account, communicationStatus.Received);
    await this.communicationModel.updateMany(
      { _id: { $in: items.map((item) => item._id) } },
      {
        status: communicationStatus.Archived,
        actionLog: { fullname: account.officer.fullName, description, date },
      },
      { session },
    );
    // * For old Schema, isOriginal is undefined
    const originals = items.filter((item) => item.isOriginal !== false);
    const affectedProcedureIds = new Set(originals.map(({ procedure }) => String(procedure.ref._id)));

    if (originals.length > 0) {
      await this.procedureModel.updateMany(
        { _id: [...affectedProcedureIds] },
        { completedAt: date, status: procedureStatus.COMPLETED, state },
        { session },
      );
    }
    return items;
  }

  private buildCommunicationInstance({ item, account, description, folder }: buildArchiveInstanteProps) {
    return new this.archiveModel({
      communication: item._id,
      dependency: account.dependencia,
      institution: account.institution,
      account: account,
      folder: folder,
      officer: { fullname: account.officer.fullName, jobtitle: account.jobtitle },
      procedure: {
        ref: item.procedure.ref,
        code: item.procedure.code,
        group: item.procedure.group,
        reference: item.procedure.reference,
      },
      isOriginal: item.isOriginal,
      description,
    });
  }
}

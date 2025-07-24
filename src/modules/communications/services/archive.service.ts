import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';

import mongoose, { FilterQuery, Model } from 'mongoose';

import { Procedure, procedureState, procedureStatus } from 'src/modules/procedures/schemas';
import { Account } from 'src/modules/administration/schemas';

import { Folder, Archive, Communication, FolderDocument, ArchiveDocument, SendStatus } from '../schemas';
import { CreateArchiveDto, FilterArchiveDto } from '../dtos';
import { InboxService } from './inbox.service';

interface buildArchiveInstanteProps {
  item: Communication;
  account: Account;
  folder: Folder | null;
  description: string;
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

      const items = await this.inboxService.archive({ ids, description, state, account, date, session });

      const models = items.map((item) => this.buildArchiveInstance({ item, description, account, folder }));

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

  async remove(id: string, account: Account) {
    const archive = await this.getValidatedArchive(id, account);

    const { communication } = archive;

    const session = await this.connection.startSession();

    try {
      session.startTransaction();
      let newCommStatus = SendStatus.Received;

      if (String(archive.account._id) !== String(account._id)) {
        newCommStatus = SendStatus.Completed;
        const newCommunication = this.createNewCommunication(communication, account);
        await newCommunication.save({ session });
      }

      await communication.updateOne({ status: newCommStatus, $unset: { actionLog: 1 } }, { session });

      if (archive.communication.isOriginal !== false) {
        await this.procedureModel.updateOne(
          { _id: communication.procedure.ref._id },
          { state: procedureState.EN_REVISION, status: procedureStatus.PENDING, $unset: { completedAt: 1 } },
          { session },
        );
      }
      await archive.deleteOne({ session });
      await session.commitTransaction();
      return { message: `Procedure unarchived`, id };
    } catch (error) {
      await session.abortTransaction();
      throw new InternalServerErrorException('Error al desarchivar tramite');
    } finally {
      session.endSession();
    }
  }

  private async getValidatedArchive(id: string, account: Account) {
    const archive = await this.archiveModel.findById(id).populate('communication');
    if (!archive || !archive?.communication) {
      throw new NotFoundException(`Archive ${id} not found, check if communication and archive exist`);
    }

    if (String(archive.dependency._id) !== String(account.dependencia._id)) {
      throw new ForbiddenException(`Archive not belonging to this dependency`);
    }

    if (archive.communication.status !== SendStatus.Archived) {
      throw new ConflictException('El trámite no se encuentra archivado');
    }

    return archive;
  }

  private buildArchiveInstance({ item, account, description, folder }: buildArchiveInstanteProps) {
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

  private createNewCommunication(current: Communication, account: Account) {
    const { recipient, procedure } = current;
    const currentDate = new Date();
    return new this.communicationModel({
      sentDate: currentDate,
      receivedDate: currentDate,
      attachmentsCount: current.attachmentsCount,
      internalNumber: '',
      status: SendStatus.Received,
      reference: 'PARA SU CONTINUACION',
      isOriginal: current.isOriginal,
      parentId: current._id,
      sender: recipient,
      recipient: {
        account: account._id,
        dependency: account.dependencia,
        institution: account.institution,
        fullname: account.officer.fullName,
        jobtitle: account.jobtitle,
      },
      procedure: {
        ref: procedure.ref,
        code: procedure.code,
        group: procedure.group,
        reference: procedure.reference,
      },
    });
  }

  // ! for new update
  async buildArchiveSchemaColecction() {
    // const communications = await this.communicationModel
    //   .find({ status: communicationStatus.Archived })
    //   .populate('recipient.account')
    //   .sort({ _id: 1 })
    //   .limit(50000)
    //   .skip(150000);

    // for (const element of communications) {
    //   const model = new this.archiveModel({
    //     account: element.recipient.account,
    //     institution: element.recipient.account.institution,
    //     dependency: element.recipient.account.dependencia,
    //     communication: element._id,
    //     officer: {
    //       fullname: element.recipient.fullname,
    //       jobtitle: element.recipient.jobtitle,
    //     },
    //     procedure: {
    //       ref: element.procedure.ref,
    //       code: element.procedure.code,
    //       group: element.procedure.group,
    //       reference: element.procedure.reference,
    //     },
    //     folder: null,
    //     description: element.actionLog.description,
    //     isOriginal: null,
    //     createdAt: element.actionLog.date,
    //     updatedAt: element.actionLog.date,
    //   });
    //   await model.save();
    // }
    return { message: 'Generated collection' };
  }
}

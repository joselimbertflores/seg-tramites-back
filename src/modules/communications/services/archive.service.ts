import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, FilterQuery, Model } from 'mongoose';

import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { Account } from 'src/modules/administration/schemas';
import { Communication, communicationStatus } from '../schemas/communication.schema';
import { Archive, ArchiveDocument, Folder, FolderDocument } from '../schemas';
import { CreateArchiveDto, FilterArchiveDto } from '../dtos';
import { Procedure, procedureStatus } from 'src/modules/procedures/schemas';

interface archiveCommunicationProps {
  communicationIds: string[];
  description: string;
  account: Account;
  session: ClientSession;
}
@Injectable()
export class ArchiveService {
  constructor(
    @InjectConnection() private connection: mongoose.Connection,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
    @InjectModel(Archive.name) private archiveModel: Model<ArchiveDocument>,
    @InjectModel(Folder.name) private folderModel: Model<FolderDocument>,
    @InjectModel(Communication.name) private communicationModel: Model<Communication>,
  ) {}

  async create(account: Account, archiveDto: CreateArchiveDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { communicationIds, folderId, description, state } = archiveDto;
      const communications = await this._archiveCommunications({ communicationIds, account, description, session });
      const originals = communications.filter((el) => el.isOriginal !== false);
      if (originals.length > 0) {
        // * Si es original o es nulo, el estado del tramite debe actualizarse
        await this.procedureModel.updateMany(
          { _id: originals.map(({ procedure }) => procedure.ref) },
          { completedAt: new Date(), status: procedureStatus.COMPLETED, state },
          { session },
        );
      }
      const models = communications.map(({ _id, procedure: { ref }, isOriginal }) => {
        return new this.archiveModel({
          communication: _id,
          dependency: account.dependencia,
          institution: account.institution,
          account: account,
          folder: folderId,
          officer: { fullname: account.officer.fullName, jobtitle: account.jobtitle },
          procedure: {
            ref: ref,
            code: ref.code,
            group: ref.group,
            reference: ref.reference,
          },
          isOriginal,
          description,
        });
      });
      await this.archiveModel.insertMany(models, { session });
      await session.commitTransaction();
      return { message: `Comunicacion archivadas: ${communications.length}` };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(`Error archive`);
    } finally {
      session.endSession();
    }
  }

  async unarchiveMail(id_mail: string, account: Account): Promise<{ message: string }> {
    const mailDB = await this.communicationModel.findById(id_mail);
    if (mailDB.status !== communicationStatus.Archived) throw new BadRequestException('El tramite ya fue desarchivado');
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      // let newStatus = StatusMail.Received;
      // if (String(mailDB.receiver.cuenta._id) !== String(account._id)) {
      //   await this.insertPartipantInWokflow(mailDB, account, session);
      //   newStatus = StatusMail.Completed;
      // }
      // await this.communicationModel.updateOne(
      //   { _id: id_mail },
      //   { status: newStatus, $unset: { eventLog: 1 } },
      //   { session },
      // );
      // await this.procedureModel.updateOne(
      //   { _id: mailDB.procedure._id },
      //   { state: stateProcedure.EN_REVISION, $unset: { endDate: 1 } },
      //   { session },
      // );
      await session.commitTransaction();
      return { message: 'Tramite desarchivado' };
    } catch (error) {
      await session.abortTransaction();
      throw new InternalServerErrorException('Error al desarchivar tramite', {
        cause: error,
      });
    } finally {
      session.endSession();
    }
  }

  async findAll({ limit, offset, term, folder }: FilterArchiveDto, account: Account) {
    const regex = new RegExp(term);
    const folderDB = await this.folderModel.findById(folder, { name: 1 });
    if (!folderDB) throw new BadRequestException(`Folder ${folder} don't existt`);
    const query: FilterQuery<Archive> = {
      dependency: account.dependencia,
      folder: folder,
      ...(term && { $or: [{ 'procedure.code': regex }, { 'procedure.reference': regex }] }),
    };
    const [archives, length] = await Promise.all([
      this.archiveModel.find(query).limit(limit).skip(offset).sort({ createdAt: -1 }),
      this.archiveModel.count(query),
    ]);
    return { archives, length, folderName: folderDB.name };
  }

  async checkIfProcedureCanBeCompleted(id_procedure: string): Promise<void> {
    // const procedureDB = await this.procedureModel.findById(id_procedure);
    // if (procedureDB.state === stateProcedure.CONCLUIDO) {
    //   throw new BadRequestException(
    //     `El tramite ${procedureDB.code} ya fue concluido.`,
    //   );
    // }
    // const isProcessStarted = await this.communicationModel.findOne({
    //   procedure: id_procedure,
    // });
    // if (isProcessStarted)
    //   throw new BadRequestException(
    //     'Solo puede concluir tramites que no hayan sido remitidos',
    //   );
  }

  async insertPartipantInWokflow(
    currentMail: Communication,
    participant: Account,
    session: mongoose.mongo.ClientSession,
  ): Promise<void> {
    const inboundDate = new Date();
    const outboundDate = new Date(inboundDate.getTime() + 1000);
    // const { receiver, attachmentQuantity, internalNumber } = currentMail;
    // const { officer } = await participant.populate({
    //   path: 'funcionario',
    //   populate: { path: 'cargo', select: 'nombre' },
    // });
    // const newMail = {
    //   procedure: currentMail.procedure._id,
    //   emitter: receiver,
    //   receiver: {
    //     cuenta: participant._id,
    //     // TODO repair user fullane
    //     fullname: '',
    //     ...(officer.cargo && { jobtitle: officer.cargo.nombre }),
    //   },
    //   outboundDate,
    //   inboundDate,
    //   reference: 'Solicita desarchivo',
    //   attachmentQuantity: attachmentQuantity,
    //   internalNumber: internalNumber,
    //   status: StatusMail.Received,
    // };
    // const createdMail = new this.communicationModel(newMail);
    // await createdMail.save({ session });
  }

  private async _archiveCommunications({ communicationIds, session, description, account }: archiveCommunicationProps) {
    const communications = await this._checkValidCommunications(communicationIds, session);
    await this.communicationModel.updateMany(
      { _id: { $in: communications.map(({ _id }) => _id) } },
      {
        status: communicationStatus.Archived,
        actionLog: { fullname: account.officer.fullName, date: new Date(), description },
      },
      { session },
    );
    return communications;
  }

  private async _checkValidCommunications(communicationIds: string[], session: ClientSession) {
    const communicationsDB = await this.communicationModel
      .find({ _id: { $in: communicationIds } }, null, { session })
      .populate('procedure.ref', 'code group reference');

    const selectedIds = communicationsDB.map(({ _id }) => _id.toString());
    const hasError = communicationIds.find((id) => !selectedIds.includes(id));
    if (hasError) {
      throw new BadRequestException(`La communicacion ${hasError} no existe`);
    }

    const isInvalid = communicationsDB.find(({ status }) => status !== communicationStatus.Received);
    if (isInvalid) {
      throw new BadRequestException(`La comunicacion $${isInvalid._id} no ha sido recibida`);
    }

    return communicationsDB;
  }
}

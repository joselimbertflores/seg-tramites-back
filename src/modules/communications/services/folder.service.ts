import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Archive, ArchiveDocument, Folder, FolderDocument } from '../schemas';
import { Account } from 'src/modules/administration/schemas';
import { CreateFolderDto } from '../dtos';

@Injectable()
export class FolderService {
  constructor(
    @InjectModel(Folder.name) private folderModel: Model<FolderDocument>,
    @InjectModel(Archive.name) private archiveModel: Model<ArchiveDocument>,
  ) {}

  async findAll(account: Account) {
    return await this.folderModel.find({ dependency: account.dependencia._id }).sort({ _id: -1 });
  }

  async create(folderDto: CreateFolderDto, account: Account) {
    try {
      return await this.folderModel.create({
        ...folderDto,
        managerName: account.officer.fullName,
        dependency: account.dependencia,
      });
    } catch (error) {
      if (error['code'] === 11000) throw new BadRequestException('El nombre de la carpeta ya existe');
      throw new InternalServerErrorException();
    }
  }

  async delete(id: string) {
    const folderDB = await this.folderModel.findById(id);
    if (!folderDB) throw new BadRequestException(`Folder ${id} don't exist`);
    const isBeingUsed = await this.archiveModel.findOne({ folder: folderDB.id });
    if (isBeingUsed) {
      throw new BadRequestException(`La carpeta contiene tramites`);
    }
    await this.folderModel.deleteOne({ _id: id });
    return { message: 'Folder deleted' };
  }
}

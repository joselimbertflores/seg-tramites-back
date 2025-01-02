import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Account } from 'src/modules/administration/schemas';
import { Folder, FolderDocument } from '../schemas';
import { CreateFolderDto } from '../dtos';

@Injectable()
export class FolderService {
  constructor(@InjectModel(Folder.name) private folderModel: Model<FolderDocument>) {}

  async create(folderDto: CreateFolderDto, account: Account) {
    try {
      return await this.folderModel.create({ ...folderDto, dependency: account.dependencia._id });
    } catch (error) {
      if (error['code'] === 11000) throw new BadRequestException('El nombre de la carpeta ya existe');
      throw new InternalServerErrorException();
    }
  }

  async findAll(account: Account) {
    return await this.folderModel.find({ dependency: account.dependencia._id });
  }

  async delete(id: string) {
    // TODO check if folder is not empty
    return await this.folderModel.findByIdAndDelete(id);
  }
}

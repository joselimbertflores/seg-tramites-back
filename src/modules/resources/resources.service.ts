import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';

import { ResourceFile, ResourceFileDocument } from './schemas/resource.schema';
import { CreateResourceFileDto } from './dto/resource-file.dto';
import { FilesService } from '../files/files.service';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(ResourceFile.name) private resourceFileModel: Model<ResourceFileDocument>,
    private fileService: FilesService,
  ) {}

  async findAll() {
    const resources = await this.resourceFileModel.find({}).lean();
    return resources.map((item) => this.plainResource(item));
  }

  async create({ category, items }: CreateResourceFileDto) {
    try {
      const createdResourceItems = items.map((item) => new this.resourceFileModel({ category, ...item }));
      await this.resourceFileModel.insertMany(createdResourceItems);
      return createdResourceItems.map((item) => this.plainResource(item));
    } catch (error) {
      console.log(error);
    }
  }

  async remove(id: string) {
    const resource = await this.resourceFileModel.findById(id);
    if (!resource) throw new BadRequestException(`Resource ${id} not found`);
    await this.resourceFileModel.deleteOne({ id });
    return { message: 'Resource removed' };
  }

  async getCategories() {
    return await this.resourceFileModel.find({}).distinct('category');
  }

  private plainResource(resource: ResourceFileDocument) {
    const plain = resource instanceof Document ? resource.toObject() : resource;
    const { fileName, ...props } = plain;
    return {
      attachments: this.fileService.buildFileUrl(fileName, 'post'),
      ...props,
    };
  }
}

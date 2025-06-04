import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';

import { ResourceFile, ResourceFileDocument } from './schemas/resource.schema';
import { CreateResourceFileDto } from './dtos/resource-file.dto';
import { FilesService } from '../files/files.service';
import { FileGroup } from '../files/file-group.enum';

interface groupedResources {
  category: string;
  files: ResourceFileDocument[];
}
@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(ResourceFile.name) private resourceFileModel: Model<ResourceFileDocument>,
    private fileService: FilesService,
  ) {}

  async findAllGroupedByCategory() {
    const grouped: groupedResources[] = await this.resourceFileModel.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$category',
          files: { $push: '$$ROOT' },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          files: 1,
        },
      },
    ]);
    return grouped.reduce((acc, curr) => {
      acc[curr.category] = curr.files.map((item) => this.plainResource(item));
      return acc;
    }, {});
  }

  async create({ category, items }: CreateResourceFileDto) {
    try {
      const createdResourceItems = items.map((item) => new this.resourceFileModel({ category, ...item }));
      await this.resourceFileModel.insertMany(createdResourceItems);
      return {
        category,
        files: createdResourceItems.map((item) => this.plainResource(item)),
      };
    } catch (error) {
      console.log(error);
    }
  }

  async remove(id: string) {
    const resource = await this.resourceFileModel.findById(id);

    if (!resource) throw new BadRequestException(`Resource ${id} not found`);

    await this.resourceFileModel.deleteOne({ _id: id });

    await this.fileService.remove(resource.fileName, FileGroup.RESOURCES);

    return { message: 'Resource removed', originalName: resource.originalName };
  }

  async getCategories() {
    return await this.resourceFileModel.find({}).distinct('category');
  }

  private plainResource(resource: ResourceFileDocument) {
    const plain = resource instanceof Document ? resource.toObject() : resource;
    const { fileName, ...props } = plain;
    return {
      fileName: this.fileService.buildFileUrl(fileName, FileGroup.RESOURCES),
      ...props,
    };
  }
}

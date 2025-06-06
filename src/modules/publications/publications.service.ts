import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';

import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { CreatePublicationDto } from './dtos/post.dto';
import { FilesService } from '../files/files.service';
import { Publication, PublicationPriority } from './schemas/publication.schema';
import { User } from '../users/schemas';
import { FileGroup } from '../files/file-group.enum';

@Injectable()
export class PublicationsService {
  constructor(
    @InjectModel(Publication.name) private publicationModel: Model<Publication>,
    private fileService: FilesService,
  ) {}

  async create(publicationDto: CreatePublicationDto, user: User) {
    const createdPublications = new this.publicationModel({
      ...publicationDto,
      user,
    });
    await createdPublications.save();
    return this.plainPublication(createdPublications);
  }

  async findByUser(userId: string, { limit, offset }: PaginationDto) {
    const [publications, length] = await Promise.all([
      this.publicationModel.find({ user: userId }).skip(offset).limit(limit).sort({ _id: -1 }).lean(),
      this.publicationModel.count({ user: userId }),
    ]);
    return {
      publications: publications.map((post) => this.plainPublication(post)),
      length,
    };
  }

  async findAll({ limit, offset }: PaginationDto) {
    const posts = await this.publicationModel.find({}).skip(offset).limit(limit).sort({ _id: -1 });
    return posts.map((post) => this.plainPublication(post));
  }

  async getNews({ limit, offset }: PaginationDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const news = await this.publicationModel
      .find({
        priority: { $ne: PublicationPriority.Low },
        expirationDate: { $gte: today },
      })
      .populate({
        path: 'user',
        populate: {
          path: 'funcionario',
          select: 'nombre paterno materno',
        },
      })
      .skip(offset)
      .limit(limit)
      .sort({ _id: -1, priority: -1 });
    return news.map((publication) => this.plainPublication(publication));
  }

  private plainPublication(publication: Publication) {
    const plain: Publication = publication instanceof Document ? publication.toObject() : publication;
    const { attachments, image, ...props } = plain;
    return {
      image: image ? this.fileService.buildFileUrl(image, FileGroup.POSTS) : null,
      attachments: attachments.map((file) => ({
        originalName: file.originalName,
        fileName: this.fileService.buildFileUrl(file.fileName, FileGroup.POSTS),
      })),
      ...props,
    };
  }
}

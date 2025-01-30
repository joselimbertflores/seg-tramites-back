import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';

import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { CreatePublicationDto } from './dtos/post.dto';
import { FilesService } from '../files/files.service';
import { Publication, PublicationPriority } from './schemas/publication.schema';
import { User } from '../users/schemas';


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
    return this._plainPublication(createdPublications);
  }

  async findByUser(userId: string, { limit, offset }: PaginationDto) {
    const [publications, length] = await Promise.all([
      this.publicationModel
        .find({ user: userId })
        .skip(offset)
        .limit(limit)
        .sort({ _id: -1 })
        .lean(),
      this.publicationModel.count({ user: userId }),
    ]);
    return {
      publications: publications.map((post) => this._plainPublication(post)),
      length,
    };
  }

  async findAll({ limit, offset }: PaginationDto) {
    const posts = await this.publicationModel
      .find({})
      .skip(offset)
      .limit(limit)
      .sort({ _id: -1 });
    return posts.map((post) => this._plainPublication(post));
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
    return news.map((publication) => this._plainPublication(publication));
  }

  private _plainPublication(publication: Publication) {
    if (publication instanceof Document) {
      publication = publication.toObject();
    }
    const { attachments, ...props } = publication;
    return {
      attachments: attachments.map((file) => ({
        title: file.title,
        filename: this.fileService.buildFileUrl(file.filename, 'post'),
      })),
      ...props,
    };
  }
}

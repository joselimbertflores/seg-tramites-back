import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PaginationDto } from 'src/common';
import { Account, Dependency } from 'src/modules/administration/schemas';
import { Doc, DocDocument, docType } from '../schemas';
import { CreateDocDto } from '../dtos';

@Injectable()
export class DocumentService {
  constructor(@InjectModel(Doc.name) private docModel: Model<DocDocument>) {}

  async findAll(account: Account, { limit, offset, term }: PaginationDto) {
    return await this.docModel.find({ dependecy: account.dependencia }).limit(limit).skip(offset);
  }

  async create(account: Account, docDto: CreateDocDto) {
    const { cite, correlative } = await this._generateCode(account.dependencia, docDto.type);
    const newDoc = new this.docModel({ segment: account.dependencia.codigo, cite, correlative, ...docDto });
    return await newDoc.save();
  }

  private async _generateCode(dependency: Dependency, type: docType) {
    const year = new Date().getFullYear();
    const lastDoc = await this.docModel
      .findOne({ dependecy: dependency, type: type, segment: dependency.codigo })
      .sort({ _id: -1 });
    const correlative = lastDoc ? lastDoc.correlative + 1 : 1;
    const cite = `${docType}/${dependency.codigo}/${correlative}/${year}`;
    return { cite, correlative };
  }
}

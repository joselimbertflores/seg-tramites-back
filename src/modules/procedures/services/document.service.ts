import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model } from 'mongoose';

import { Account, Dependency } from 'src/modules/administration/schemas';
import { Doc, DocDocument, docType } from '../schemas';
import { CreateDocDto, UpdateDocDto } from '../dtos';
import { PaginationDto } from 'src/common';

interface procedureProps {
  code: string;
  group: string;
}

@Injectable()
export class DocumentService {
  constructor(@InjectModel(Doc.name) private docModel: Model<DocDocument>) {}

  public async attachProcedure(docId: string, procedure: procedureProps, session?: ClientSession) {
    const doc = await this.docModel.findById(docId, null, { session });
    if (!doc) throw new BadRequestException(`Document ${docId} not found`);
    if (doc.procedure) {
      throw new BadRequestException(`${doc.cite} ya se adjunto a la hoja de ruta ${doc.procedure.code}`);
    }
    await this.docModel.updateOne({ _id: docId }, { procedure }, { session });
  }

  async findAll(account: Account, { limit, offset }: PaginationDto) {
    const { startOfYear, endOfYear } = this._getYearRange();
    const filterQuery: FilterQuery<Doc> = {
      account: account._id,
      dependecy: account.dependencia._id,
      createdAt: { $gte: startOfYear, $lt: endOfYear },
    };
    const [documents, length] = await Promise.all([
      this.docModel.find(filterQuery).skip(offset).limit(limit),
      this.docModel.count(filterQuery),
    ]);
    return { documents, length };
  }

  async create(account: Account, docDto: CreateDocDto) {
    const { cite, correlative } = await this._generateCode(account.dependencia, docDto.type);
    const newDoc = new this.docModel({
      segment: account.dependencia.codigo,
      account: account,
      dependecy: account.dependencia,
      correlative,
      cite,
      ...docDto,
    });
    return await newDoc.save();
  }

  async update(id: string, docDto: UpdateDocDto) {
    const doc = await this.docModel.findById(id);
    if (!doc) throw new BadRequestException(`Document ${id} not found`);
    return await this.docModel.findByIdAndUpdate(id, docDto, { new: true });
  }

  async searchPendingDocs(account: Account, term?: string) {
    const regex = new RegExp(term, 'i');
    const { startOfYear, endOfYear } = this._getYearRange();
    return await this.docModel
      .find({
        account: account._id,
        procedure: null,
        createdAt: { $gte: startOfYear, $lt: endOfYear },
        ...(term && { $or: [{ cite: regex }, { reference: regex }] }),
      })
      .limit(5);
  }

  private async _generateCode({ _id, codigo }: Dependency, type: docType) {
    const year = new Date().getFullYear();
    const lastDoc = await this.docModel.findOne({ dependecy: _id, segment: codigo, type }).sort({ _id: -1 });
    const correlative = lastDoc ? lastDoc.correlative + 1 : 1;
    const cite = `${type}/${codigo}/${correlative}/${year}`;
    return { cite, correlative };
  }

  private _getYearRange(year: number = new Date().getFullYear()) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);
    return { startOfYear, endOfYear };
  }
}

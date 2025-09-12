import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { FilterQuery, Model } from 'mongoose';

import { PaginationDto } from 'src/modules/common';
import { Account } from 'src/modules/administration/schemas';
import { InternalProcedure, InternalProcedureDocument, procedureStatus, ProcurementProcedure } from '../schemas';
import { CreateProcurementProcedureDto, UpdatedDocumentProcurementDto, UpdateProcurementProcedureDto } from '../dtos';
import { ValidProcedureService } from '../domain';

@Injectable()
export class ProcurementService implements ValidProcedureService {
  constructor(
    @InjectModel(ProcurementProcedure.name) private procedureModel: Model<ProcurementProcedure>,
    @InjectModel(InternalProcedure.name) private internalProcedureModel: Model<InternalProcedureDocument>,
    private configService: ConfigService,
  ) {}

  async findAll({ limit, offset, term }: PaginationDto, accountId: string) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<ProcurementProcedure> = {
      account: accountId,
      status: procedureStatus.PENDING,
      $or: [{ code: regex }, { reference: regex }],
    };
    const [procedures, length] = await Promise.all([
      this.procedureModel.find(query).lean().sort({ _id: -1 }).limit(limit).skip(offset),
      this.procedureModel.countDocuments(query),
    ]);
    return { procedures, length };
  }

  async create(procedureDto: CreateProcurementProcedureDto, account: Account) {
    const { correlative, code, prefix } = await this.generateCode(account);
    const createdProcedure = new this.procedureModel({
      account: account._id,
      institution: account.institution,
      dependency: account.dependencia,
      code: code,
      prefix,
      correlative,
      ...procedureDto,
    });
    return await createdProcedure.save();
  }

  async update(id: string, procedureDto: UpdateProcurementProcedureDto) {
    const procedureDB = await this.procedureModel.findById(id);
    if (!procedureDB) throw new NotFoundException(`Procedure ${id} not found`);
    return await this.procedureModel.findByIdAndUpdate(id, procedureDto, { new: true });
  }

  async updateDocuments(id: string, { index, properties }: UpdatedDocumentProcurementDto) {
    const procedure = await this.procedureModel.findByIdAndUpdate(
      id,
      {
        $set: { [`documents.${index}`]: properties },
      },
      { new: true },
    );
    return procedure.documents[index];
  }

  async getDetail(id: string) {
    const procedureDB = await this.procedureModel.findById(id).populate('account');
    if (!procedureDB) throw new NotFoundException(`Procedure ${id} not found`);
    return procedureDB;
  }

 private async generateCode({ institution }: Account) {
    const prefix = 'HR';
    const year = this.configService.get('YEAR') || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const last = await this.internalProcedureModel
      .findOne({ prefix, institution, createdAt: { $gte: startDate, $lt: endDate } }, { correlative: 1 })
      .sort({ _id: -1 });

    const correlative = last ? last.correlative + 2 : 1;

    return {
      prefix,
      correlative,
      code: `${prefix}-${institution.sigla}-${year}-${correlative.toString().padStart(5, '0')}`,
    };
  }
}

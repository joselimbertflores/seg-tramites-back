import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';

import { ExternalProcedure, procedureState, procedureStatus } from '../schemas';
import type { Account } from 'src/modules/administration/schemas';

import { PaginationDto } from 'src/modules/common';
import { CreateExternalProcedureDto, UpdateExternalProcedureDto } from '../dtos';
import { ValidProcedureService } from '../domain';

@Injectable()
export class ExternalService implements ValidProcedureService {
  constructor(
    @InjectModel(ExternalProcedure.name) private procedureModel: Model<ExternalProcedure>,
    private configService: ConfigService,
  ) {}

  async findAll({ limit, offset, term }: PaginationDto, accountId: string) {
    const query: FilterQuery<ExternalProcedure> = { account: accountId, status: procedureStatus.PENDING };
    if (term) {
      Object.assign(query, isNaN(+term) ? { reference: { $regex: term, $options: 'i' } } : { code: { $regex: term } });
    }
    const [procedures, length] = await Promise.all([
      this.procedureModel.find(query).lean().populate('account').sort({ _id: 'desc' }).limit(limit).skip(offset),
      this.procedureModel.countDocuments(query),
    ]);
    return { procedures, length };
  }

  async create(procedureDto: CreateExternalProcedureDto, account: Account) {
    const { segment, ...props } = procedureDto;
    const { code, correlative, prefix } = await this.generateCode(account, segment);
    const createdProcedure = new this.procedureModel({
      account: account._id,
      dependency: account.dependencia,
      institution: account.institution,
      pin: Math.floor(100000 + Math.random() * 900000),
      correlative,
      prefix,
      code,
      ...props,
    });
    return await createdProcedure.save();
  }

  async update(id: string, procedureDto: UpdateExternalProcedureDto) {
    const procedureDB = await this.procedureModel.findById(id);
    if (!procedureDB) throw new NotFoundException(`Procedure ${id} not found`);
    if (procedureDB.state !== procedureState.INSCRITO) {
      throw new BadRequestException('El tramite ya esta en curso');
    }
    return await this.procedureModel.findByIdAndUpdate(id, procedureDto, { new: true });
  }

  async getDetail(id: string) {
    const procedure = await this.procedureModel.findById(id).populate('type', 'nombre');
    if (!procedure) throw new NotFoundException(`Procedure ${id} not found`);
    return procedure;
  }

  private async generateCode({ institution }: Account, segment: string) {
    const prefix = segment.trim().toUpperCase();
    const year = this.configService.get('YEAR') || new Date().getFullYear();

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const last = await this.procedureModel
      .findOne({ prefix: prefix, institution, createdAt: { $gte: startDate, $lt: endDate } }, { correlative: 1 })
      .sort({ _id: -1 });

    const correlative = last ? last.correlative + 1 : 1;

    return {
      prefix,
      correlative,
      code: `${prefix}-${institution.sigla}-${year}-${correlative.toString().padStart(6, '0')}`,
    };
  }
}

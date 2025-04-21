import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { FilterQuery, Model } from 'mongoose';

import { Account } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/modules/common';
import { InternalProcedure, procedureState, procedureStatus } from '../schemas';
import { CreateInternalProcedureDto, UpdateInternalProcedureDto } from '../dtos';
import { validProcedureService } from '../domain';

@Injectable()
export class InternalService implements validProcedureService {
  constructor(
    @InjectModel(InternalProcedure.name) private procedureModel: Model<InternalProcedure>,
    private configService: ConfigService,
  ) {}

  async create(procedureDto: CreateInternalProcedureDto, account: Account) {
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

  async update(id: string, procedureDto: UpdateInternalProcedureDto) {
    const procedureDB = await this.procedureModel.findById(id);
    if (!procedureDB) throw new NotFoundException(`Procedure ${id} not found`);
    if (procedureDB.state !== procedureState.INSCRITO) {
      throw new BadRequestException('El tramite ya esta en curso');
    }
    return await this.procedureModel.findByIdAndUpdate(id, procedureDto, { new: true });
  }

  async findAll({ limit, offset, term }: PaginationDto, accountId: string) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<InternalProcedure> = {
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

  async getDetail(id: string): Promise<any> {
    const procedureDB = await this.procedureModel.findById(id).populate('account');
    if (!procedureDB) throw new NotFoundException(`Procedure ${id} not found`);
    return procedureDB;
  }

  async generateCode(account: Account) {
    const prefix = `HR-${account.institution.sigla}`.trim().toUpperCase();
    const last = await this.procedureModel.findOne({ prefix: prefix }, { correlative: 1 }).sort({ _id: -1 });
    const correlative = last ? last.correlative + 1 : 1;
    return {
      prefix,
      correlative,
      code: `${prefix}-${this.configService.get('YEAR')}-${correlative.toString().padStart(5, '0')}`,
    };
  }
}

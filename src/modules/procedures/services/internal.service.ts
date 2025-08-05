import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { FilterQuery, Model } from 'mongoose';

import { Account } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/modules/common';
import { InternalProcedure, procedureState, procedureStatus } from '../schemas';
import { CreateInternalProcedureDto, UpdateInternalProcedureDto } from '../dtos';
import { ValidProcedureService } from '../domain';

@Injectable()
export class InternalService implements ValidProcedureService {
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
    const query: FilterQuery<InternalProcedure> = {
      account: accountId,
      status: procedureStatus.PENDING,
    };
    if (term) {
      Object.assign(query, isNaN(+term) ? { reference: { $regex: term, $options: 'i' } } : { code: { $regex: term } });
    }
    const [procedures, length] = await Promise.all([
      this.procedureModel.find(query).lean().sort({ _id: 'desc' }).limit(limit).skip(offset),
      this.procedureModel.countDocuments(query),
    ]);
    return { procedures, length };
  }

  async getDetail(id: string): Promise<any> {
    const procedureDB = await this.procedureModel.findById(id).populate('account');
    if (!procedureDB) throw new NotFoundException(`Procedure ${id} not found`);
    return procedureDB;
  }

  async generateCode({ institution }: Account) {
    const prefix = 'HR';
    const year = this.configService.get('YEAR') || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const last = await this.procedureModel
      .findOne({ prefix, institution, createdAt: { $gte: startDate, $lt: endDate } }, { correlative: 1 })
      .sort({ _id: -1 });

    const correlative = last ? last.correlative + 1 : 1;

    return {
      prefix,
      correlative,
      code: `${prefix}-${institution.sigla}-${year}-${correlative.toString().padStart(5, '0')}`,
    };
  }
}

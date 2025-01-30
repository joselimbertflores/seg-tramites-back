import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';

import { ExternalProcedure, procedureStatus } from '../schemas';

import { stateProcedure } from '../interfaces';
import { PaginationDto } from 'src/modules/common';
import { Account } from 'src/modules/administration/schemas';
import { CreateExternalProcedureDto, UpdateExternalProcedureDto } from '../dtos';

@Injectable()
export class ExternalService {
  constructor(
    @InjectModel(ExternalProcedure.name) private procedureModel: Model<ExternalProcedure>,
    private configService: ConfigService,
  ) {}

  async findAll({ limit, offset, term }: PaginationDto, accountId: string) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<ExternalProcedure> = {
      account: accountId,
      status: procedureStatus.PENDING,
      ...(term && { $or: [{ code: regex }, { reference: regex }] }),
    };
    const [procedures, length] = await Promise.all([
      this.procedureModel.find(query).populate('account').sort({ _id: -1 }).limit(limit).skip(offset),
      this.procedureModel.count(query),
    ]);
    return { procedures, length };
  }

  async create(procedureDto: CreateExternalProcedureDto, account: Account) {
    const { segment, ...props } = procedureDto;
    const { code, correlative, prefix } = await this._generateCode(account, segment);
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
    if (!procedureDB) {
      throw new NotFoundException('El tramite no existe');
    }
    if (procedureDB.state !== stateProcedure.INSCRITO) {
      throw new BadRequestException('El tramite ya esta en curso');
    }
    return await this.procedureModel.findByIdAndUpdate(id, procedureDto, { new: true });
  }

  private async _generateCode(
    account: Account,
    segment: string,
  ): Promise<{ code: string; prefix: string; correlative: number }> {
    const prefix = `${segment}-${account.institution.sigla}`.toUpperCase();
    const last = await this.procedureModel.findOne({ prefix: prefix }, { correlative: 1 }).sort({ _id: -1 });
    const correlative = last ? last.correlative + 1 : 1;
    return {
      prefix,
      correlative,
      code: `${prefix}-${this.configService.get('YEAR')}-${correlative.toString().padStart(6, '0')}`,
    };
  }
}

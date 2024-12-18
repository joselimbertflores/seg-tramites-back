import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';

import { Account } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/common';
import { InternalProcedure, procedureStatus } from '../schemas';
import { stateProcedure } from '../interfaces';
import { CreateInternalProcedureDto, UpdateInternalProcedureDto } from '../dtos';

@Injectable()
export class InternalService {
  constructor(
    @InjectModel(InternalProcedure.name) private procedureModel: Model<InternalProcedure>,
    private configService: ConfigService,
  ) {}

  async create(procedureDto: CreateInternalProcedureDto, account: Account) {
    const { correlative, code, prefix } = await this._generateCode(account);
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
    if (!procedureDB) {
      throw new NotFoundException('El tramite no existe');
    }
    if (procedureDB.state !== stateProcedure.INSCRITO) {
      throw new BadRequestException('El tramite ya esta en curso');
    }
    return await this.procedureModel.findByIdAndUpdate(id, procedureDto, { new: true });
  }

  async findAll({ limit, offset, term }: PaginationDto, accountId: string) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<InternalProcedure> = {
      account: accountId,
      status: procedureStatus.PENDING,
      // $or: [{ code: regex }, { reference: regex }],
    };
    const [procedures, length] = await Promise.all([
      this.procedureModel.find(query).sort({ _id: -1 }).limit(limit).skip(offset).lean(),
      this.procedureModel.count(query),
    ]);
    return { procedures, length };
  }

  private async _generateCode(account: Account): Promise<{ code: string; prefix: string; correlative: number }> {
    const prefix = `HR-${account.institution.sigla}`.toUpperCase();
    const last = await this.procedureModel.findOne({ prefix: prefix }, { correlative: 1 }).sort({ _id: -1 });
    const correlative = last ? last.correlative + 1 : 1;
    return {
      prefix,
      correlative,
      code: `${prefix}-${this.configService.get('YEAR')}-${correlative.toString().padStart(5, '0')}`,
    };
  }
}

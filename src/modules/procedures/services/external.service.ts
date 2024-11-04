import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';
import { ExternalProcedure } from '../schemas';

import { stateProcedure } from '../interfaces';
import { PaginationDto } from 'src/common';
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
    const code = await this._generateCode(account, segment);
    const createdProcedure = new this.procedureModel({
      account: account._id,
      code: code,
      pin: Math.floor(100000 + Math.random() * 900000),
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

  async getOne(id: string) {
    const procedureDB = await this.procedureModel.findById(id).populate('account').populate('type', 'nombre');
    if (!procedureDB) throw new NotFoundException(`El tramite ${id} no existe.`);
    return procedureDB;
  }

  private async _generateCode(account: Account, segment: string): Promise<string> {
    const { dependencia } = await account.populate({
      path: 'dependencia.institucion',
    });
    const code = `${segment}-${dependencia.institucion.sigla}-${this.configService.get('YEAR')}`.toUpperCase();
    const correlative = await this.procedureModel.count({
      code: new RegExp(code),
    });
    return `${code}-${String(correlative + 1).padStart(6, '0')}`;
  }
}

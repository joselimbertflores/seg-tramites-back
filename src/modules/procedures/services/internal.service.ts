import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';

import { Account } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/common';
import { InternalProcedure } from '../schemas';
import { stateProcedure } from '../interfaces';
import { CreateInternalProcedureDto, UpdateInternalProcedureDto } from '../dtos';

@Injectable()
export class InternalService {
  constructor(
    @InjectModel(InternalProcedure.name) private procedureModel: Model<InternalProcedure>,
    private configService: ConfigService,
  ) {}

  async create(procedureDto: CreateInternalProcedureDto, account: Account) {
    const { segment, ...props } = procedureDto;
    const code = await this.generateCode(account, segment);
    const createdProcedure = new this.procedureModel({
      account: account._id,
      code: code,
      ...props,
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
      $or: [{ code: regex }, { reference: regex }],
    };
    const [procedures, length] = await Promise.all([
      this.procedureModel.find(query).sort({ _id: -1 }).limit(limit).skip(offset).lean(),
      this.procedureModel.count(query),
    ]);
    return { procedures, length };
  }

  async getOne(id: string) {
    const procedureDB = await this.procedureModel.findById(id).populate('account').populate('type', 'nombre');
    if (!procedureDB) throw new NotFoundException(`El tramite ${id} no existe.`);
    return procedureDB;
  }

  private async generateCode(account: Account, segment: string): Promise<string> {
    const { dependencia } = await account.populate({
      path: 'dependencia.institucion',
    });
    const code = `${segment}-${dependencia.institucion.sigla}-${this.configService.get('YEAR')}`.toUpperCase();
    const correlative = await this.procedureModel.count({
      group: InternalProcedure.name,
      code: new RegExp(code, 'i'),
    });
    return `${code}-${String(correlative + 1).padStart(5, '0')}`;
  }
}

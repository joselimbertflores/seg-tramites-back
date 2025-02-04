import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection, FilterQuery, Model } from 'mongoose';

import { Account } from 'src/modules/administration/schemas';
import { DocumentService } from './document.service';
import { procedureState, procedureStatus, ProcurementProcedure } from '../schemas';
import { CreateProcurementProcedureDto, UpdateProcurementProcedureDto } from '../dtos';
import { PaginationDto } from 'src/modules/common';

@Injectable()
export class ProcurementService {
  constructor(
    @InjectModel(ProcurementProcedure.name) private procedureModel: Model<ProcurementProcedure>,
    @InjectConnection() private connection: Connection,
    private configService: ConfigService,
    private docService: DocumentService,
  ) {}

  async create({ docId, ...props }: CreateProcurementProcedureDto, account: Account) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const { correlative, code, prefix } = await this._generateCode(account);
      const createdProcedure = new this.procedureModel({
        account: account._id,
        institution: account.institution,
        dependency: account.dependencia,
        code: code,
        prefix,
        correlative,
        ...props,
      });
      const procedure = await createdProcedure.save({ session });
      if (docId) {
        await this.docService.attachProcedure(docId, { code: procedure.code, group: procedure.group }, session);
      }
      await session.commitTransaction();
      return procedure;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      await session.abortTransaction();
      throw new InternalServerErrorException();
    } finally {
      session.endSession();
    }
  }

  async update(id: string, procedureDto: UpdateProcurementProcedureDto) {
    const procedureDB = await this.procedureModel.findById(id);
    if (!procedureDB) {
      throw new NotFoundException('El tramite no existe');
    }
    if (procedureDB.state !== procedureState.INSCRITO) {
      throw new BadRequestException('El tramite ya esta en curso');
    }
    return await this.procedureModel.findByIdAndUpdate(id, procedureDto, { new: true });
  }

  async findAll({ limit, offset, term }: PaginationDto, accountId: string) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<ProcurementProcedure> = {
      account: accountId,
      status: procedureStatus.PENDING,
      $or: [{ code: regex }, { reference: regex }],
    };
    const [procedures, length] = await Promise.all([
      this.procedureModel.find(query).sort({ _id: -1 }).limit(limit).skip(offset).lean(),
      this.procedureModel.count(query),
    ]);
    return { procedures, length };
  }

  async getDetail(procedureId: string): Promise<any> {
    const procedureDB = await this.procedureModel.findById(procedureId).populate('account');
    if (!procedureDB) throw new NotFoundException(`El tramite ${procedureId} no existe.`);
    return procedureDB;
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

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import { TypeProcedure } from '../schemas/type-procedure.schema';
import { PaginationDto } from 'src/modules/common';
import { CreateTypeProcedureDto, UpdateTypeProcedureDto } from '../dtos';

@Injectable()
export class TypeProcedureService {
  constructor(@InjectModel(TypeProcedure.name) private typeProcedureModel: Model<TypeProcedure>) {}

  async findAll({ limit, offset, term }: PaginationDto) {
    const query: FilterQuery<TypeProcedure> = {
      ...(term && { nombre: new RegExp(term, 'i') }),
    };
    const [types, length] = await Promise.all([
      this.typeProcedureModel.find(query).lean().skip(offset).limit(limit).sort({ _id: "descending" }),
      this.typeProcedureModel.count(query),
    ]);
    return { types, length };
  }

  async create(typeProcedure: CreateTypeProcedureDto) {
    const createdTypeProcedure = new this.typeProcedureModel(typeProcedure);
    return await createdTypeProcedure.save();
  }

  async update(id: string, typeProcedure: UpdateTypeProcedureDto) {
    return this.typeProcedureModel.findByIdAndUpdate(id, typeProcedure, {
      new: true,
    });
  }

  async getEnabledTypesBySegment(segment: string) {
    return await this.typeProcedureModel
      .find({
        segmento: segment.toUpperCase(),
        activo: true,
      })
      .lean();
  }

  async getEnabledTypesByGroup(group: string) {
    return await this.typeProcedureModel.find({ activo: true, tipo: group }).lean().limit(10);
  }

  async getTypesByText(term?: string, all = false) {
    return await this.typeProcedureModel
      .find({
        ...(term && { nombre: new RegExp(term, 'i') }),
        ...(!all ? { activo: true } : {}),
      })
      .lean()
      .limit(5);
  }

  public async getSegments(): Promise<string[]> {
    return await this.typeProcedureModel.find({}).distinct('segmento');
  }
}

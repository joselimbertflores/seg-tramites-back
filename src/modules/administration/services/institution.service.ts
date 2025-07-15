import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import { Institution } from '../schemas/institution.schema';
import { CreateInstitutionDto, UpdateInstitutionDto } from '../dtos';
import { PaginationDto } from 'src/modules/common';

@Injectable()
export class InstitutionService {
  constructor(@InjectModel(Institution.name) private institutionModel: Model<Institution>) {}


  public async getActiveInstitutions() {
    return await this.institutionModel.find({ activo: true });
  }

  async findAll({ limit, offset, term }: PaginationDto) {
    const query: FilterQuery<Institution> = {
      ...(term && { nombre: new RegExp(term, 'i') }),
    };
    const [institutions, length] = await Promise.all([
      this.institutionModel.find(query).lean().skip(offset).limit(limit).sort({ _id: 'descending' }),
      this.institutionModel.count(query),
    ]);
    return { institutions, length };
  }

  async create(institution: CreateInstitutionDto) {
    await this.checkDuplicateCode(institution.sigla);
    const createdInstitucion = new this.institutionModel(institution);
    return await createdInstitucion.save();
  }

  async update(id: string, institution: UpdateInstitutionDto) {
    const institutionDB = await this.institutionModel.findById(id);
    if (!institutionDB) {
      throw new NotFoundException(`La institucion ${id} no existe`);
    }
    if (institution.sigla && institution.sigla !== institutionDB.sigla) {
      await this.checkDuplicateCode(institution.sigla);
    }
    return await this.institutionModel.findByIdAndUpdate(id, institution, {
      new: true,
    });
  }

  private async checkDuplicateCode(sigla: string): Promise<void> {
    const duplicate = await this.institutionModel.findOne({ sigla });
    if (duplicate) {
      throw new BadRequestException(`La sigla: ${sigla} ya existe`);
    }
  }
}

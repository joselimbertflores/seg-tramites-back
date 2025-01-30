import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Institution } from '../schemas/institution.schema';
import { CreateInstitutionDto, UpdateInstitutionDto } from '../dtos';
import { PaginationDto } from 'src/modules/common';

@Injectable()
export class InstitutionService {
  constructor(
    @InjectModel(Institution.name) private institutionModel: Model<Institution>,
  ) {}

  async findAll({ limit, offset }: PaginationDto) {
    const [institutions, length] = await Promise.all([
      this.institutionModel
        .find({})
        .lean()
        .skip(offset)
        .limit(limit)
        .sort({ _id: -1 }),
      this.institutionModel.count({}),
    ]);
    return { institutions, length };
  }

  async add(institution: CreateInstitutionDto) {
    await this.checkDuplicateCode(institution.sigla);
    const createdInstitucion = new this.institutionModel(institution);
    return await createdInstitucion.save();
  }

  async edit(id: string, institution: UpdateInstitutionDto) {
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
    const duplicate = await this.institutionModel.findOne({
      sigla: sigla.toUpperCase().trim(),
    });
    if (duplicate) {
      throw new BadRequestException(`La sigla: ${sigla} ya existe`);
    }
  }

  public async getActiveInstitutions() {
    return await this.institutionModel.find({ activo: true });
  }
}

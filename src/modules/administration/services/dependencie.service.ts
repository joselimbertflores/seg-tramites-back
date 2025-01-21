import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import { Dependency } from '../schemas/dependencie.schema';
import { CreateDependencyDto, UpdateDependencyDto } from '../dtos';
import { PaginationDto } from 'src/common';

@Injectable()
export class DependencieService {
  constructor(@InjectModel(Dependency.name) private dependencyModel: Model<Dependency>) {}

  async findAll({ limit, offset, term }: PaginationDto) {
    const query: FilterQuery<Dependency> = {
      ...(term && { nombre: new RegExp(term, 'i') }),
    };
    const [dependencies, length] = await Promise.all([
      this.dependencyModel.find(query).lean().populate('institucion').skip(offset).limit(limit).sort({ _id: -1 }),
      this.dependencyModel.count(query),
    ]);
    return { dependencies, length };
  }

  async create(dependency: CreateDependencyDto) {
    const createdDependency = new this.dependencyModel(dependency);
    await createdDependency.save();
    return await createdDependency.populate('institucion');
  }

  async update(id: string, dependency: UpdateDependencyDto) {
    return await this.dependencyModel.findByIdAndUpdate(id, dependency, { new: true }).populate('institucion');
  }

  public async getActiveDependenciesOfInstitution(institutionId: string) {
    return await this.dependencyModel
      .find({
        activo: true,
        institucion: institutionId,
      })
      .lean();
  }
}

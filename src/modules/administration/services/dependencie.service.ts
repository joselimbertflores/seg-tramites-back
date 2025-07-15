import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model } from 'mongoose';

import { AssignDependencyAreasDto, CreateDependencyDto, UpdateDependencyDto } from '../dtos';
import { Account, Dependency } from '../schemas';
import { PaginationDto } from 'src/modules/common';

@Injectable()
export class DependencieService {
  constructor(
    @InjectModel(Dependency.name) private dependencyModel: Model<Dependency>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectConnection() private connection: mongoose.Connection,
  ) {}

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

  async update(id: string, dependencyDto: UpdateDependencyDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const dependencyDB = await this.dependencyModel.findById(id, null, { session });
      if (!dependencyDB) throw new BadRequestException(`Dependency ${id} dont exist`);
      const newCodes = dependencyDto.areas.map((area) => area.code);
      for (const { code } of dependencyDB.areas) {
        if (!newCodes.includes(code)) {
          await this.accountModel.updateMany(
            { dependencia: dependencyDB, area: code },
            { $unset: { area: '' } },
            { session },
          );
        }
      }
      const updated = await this.dependencyModel
        .findByIdAndUpdate(id, dependencyDto, { new: true, session })
        .populate('institucion');
      await session.commitTransaction();
      return updated;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      session.endSession();
    }
  }

  async getAccountsInDependency(dependencyId: string) {
    return await this.accountModel.find({ dependencia: dependencyId }).populate('dependencia').populate('officer');
  }

  async assignAreas({ personnel }: AssignDependencyAreasDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      for (const { accountId, area } of personnel) {
        if (area === null) {
          await this.accountModel.updateOne({ _id: accountId }, { $unset: { area: '' } }, { session });
        } else {
          await this.accountModel.updateOne({ _id: accountId }, { area }, { session });
        }
      }
      await session.commitTransaction();
      return { message: 'Assignment completed' };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      session.endSession();
    }
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

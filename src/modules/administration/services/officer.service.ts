import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Model, MongooseError } from 'mongoose';
import { CreateOfficerDto, UpdateOfficerDto } from '../dtos';
import { Officer } from '../schemas';
import { PaginationDto } from 'src/modules/common';
import { MongoServerError } from 'mongodb';

@Injectable()
export class OfficerService {
  constructor(
    @InjectModel(Officer.name) private officerModel: Model<Officer>,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  public async findOfficersForProcess(text: string, limit = 7) {
    const regex = new RegExp(text, 'i');
    return await this.officerModel
      .aggregate()
      .match({ activo: true })
      .addFields({
        fullname: {
          $concat: ['$nombre', ' ', { $ifNull: ['$paterno', ''] }, ' ', { $ifNull: ['$materno', ''] }],
        },
      })
      .match({ fullname: regex })
      .limit(limit)
      .project({ fullname: 0 })
      .lookup({
        from: 'cargos',
        localField: 'cargo',
        foreignField: '_id',
        as: 'cargo',
      })
      .unwind({
        path: '$cargo',
        preserveNullAndEmptyArrays: true,
      });
  }

  async findAll({ limit, offset, term }: PaginationDto) {
    const regex = new RegExp(term, 'i');
    const dataPaginated = await this.officerModel
      .aggregate()
      .addFields({
        fullname: {
          $concat: [
            { $ifNull: ['$nombre', ''] },
            ' ',
            { $ifNull: ['$paterno', ''] },
            ' ',
            { $ifNull: ['$materno', ''] },
          ],
        },
      })
      .match({
        $or: [{ fullname: regex }, { dni: regex }],
      })
      .sort({ _id: -1 })
      .facet({
        paginatedResults: [{ $skip: offset }, { $limit: limit }],
        totalCount: [
          {
            $count: 'count',
          },
        ],
      });
    const officers = dataPaginated[0].paginatedResults;
    const length = dataPaginated[0].totalCount[0] ? dataPaginated[0].totalCount[0].count : 0;
    return { officers, length };
  }

  async create(officer: CreateOfficerDto, session?: ClientSession) {
    try {
      // await this.checkDuplicateDni(officer.dni);
      console.log(officer);
      const createdOfficer = new this.officerModel(officer);
      return createdOfficer.save({ session });
    } catch (error) {
      console.log("paso ub erro");
      console.log('object');
      if (error instanceof MongoServerError) {
      }
      // console.log(typeof error);
      throw new InternalServerErrorException();
    }
  }

  async edit(id: string, data: UpdateOfficerDto, session?: ClientSession) {
    const officerDB = await this.officerModel.findById(id);
    if (!officerDB) {
      throw new NotFoundException(`El funcionario ${id} no existe`);
    }
    if (data.dni && data.dni != officerDB.dni) {
      await this.checkDuplicateDni(data.dni);
    }
    return await this.officerModel.findByIdAndUpdate(id, data, {
      new: true,
      session,
    });
  }

  async searchOfficersWithoutAccount(text: string, limit = 5) {
    const regex = new RegExp(text, 'i');
    return await this.officerModel
      .aggregate()
      .addFields({
        fullname: {
          $concat: [
            { $ifNull: ['$nombre', ''] },
            ' ',
            { $ifNull: ['$paterno', ''] },
            ' ',
            { $ifNull: ['$materno', ''] },
          ],
        },
      })
      .match({ fullname: regex, activo: true })
      .lookup({
        from: 'accounts',
        localField: '_id',
        foreignField: 'funcionario',
        as: 'account',
      })
      .match({ account: { $size: 0 } })
      .project({ account: 0, fullname: 0 })
      .limit(limit);
  }

  private async checkDuplicateDni(dni: string): Promise<void> {
    const officer = await this.officerModel.findOne({ dni });
    if (officer) throw new BadRequestException(`El numero de CI ${dni} ya ha sido registrado`);
  }
}

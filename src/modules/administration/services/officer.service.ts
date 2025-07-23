import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateOfficerDto, UpdateOfficerDto } from '../dtos';
import { PaginationDto } from 'src/modules/common';
import { Officer } from '../schemas';

@Injectable()
export class OfficerService {
  constructor(@InjectModel(Officer.name) private officerModel: Model<Officer>) {}

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
        from: 'cuentas',
        localField: '_id',
        foreignField: 'officer',
        as: 'account',
      })
      .match({ account: { $size: 0 } })
      .project({ account: 0, fullname: 0 })
      .limit(limit);
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

  async create(officer: CreateOfficerDto) {
    try {
      const createdOfficer = new this.officerModel(officer);
      return await createdOfficer.save();
    } catch (error) {
      if (error['code'] === 11000) {
        throw new BadRequestException(`El numero de CI ${officer.dni} ya ha sido registrado`);
      }
      throw new InternalServerErrorException('Error create officer');
    }
  }

  async update(id: string, data: UpdateOfficerDto) {
    try {
      const officerDB = await this.officerModel.findById(id);
      if (!officerDB) throw new NotFoundException(`El funcionario ${id} no existe`);
      return await this.officerModel.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      if (error['code'] === 11000) {
        throw new BadRequestException(`El numero de CI ${data.dni} ya ha sido registrado`);
      }
      throw new InternalServerErrorException('Error update officer');
    }

    // TODO repairt number dnti to string
    // const officers = await this.officerModel.find();
    // console.log(`Procesando ${officers.length} funcionarios...`);
    // for (const officer of officers) {
    //   const dni = officer.dni;
    //   const stringDni = dni.toString().trim();
    //   await this.officerModel.updateOne({ _id: officer._id }, { $set: { dni: stringDni } });
    //     console.log(`✅ _id: ${officer._id} - DNI convertido a string: "${stringDni}"`);
    // }
    // TODO: Repair ConflictException, check dni_1
    // db.officers.dropIndex('dni_1');
    // db.officers.createIndex({ dni: 1 }, { unique: true });
  }
}

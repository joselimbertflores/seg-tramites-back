import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UpdateOfficerDto } from '../dtos';
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

  async update(id: string, data: UpdateOfficerDto) {
    const officerDB = await this.officerModel.findById(id);
    if (!officerDB) throw new NotFoundException(`El funcionario ${id} no existe`);

    try {
      return await this.officerModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    } catch {
      throw new InternalServerErrorException('Error update officer');
    }
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Project } from './schemas';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { PaginationDto } from '../common';
import { CreateProjectDio, UpdateProjectDto } from './dots/project.dto';
import { Account } from '../administration/schemas';
import { nanoid } from 'nanoid';
import { InternalProcedure } from '../procedures/schemas';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(InternalProcedure.name) private procedureModel: Model<InternalProcedure>,
  ) {}

  async findAll({ limit, offset, term }: PaginationDto, accountId: string) {
    const regex = new RegExp(term, 'i');
    const query = {
      account: accountId,
      $or: [{ code: regex }, { reference: regex }],
    };
    const [projects, length] = await Promise.all([
      this.projectModel.find(query).lean().sort({ _id: -1 }).limit(limit).skip(offset),
      this.projectModel.countDocuments(query),
    ]);
    return { projects, length };
  }

  async create(projectDto: CreateProjectDio, account: Account) {
    const code = `PRJ-${nanoid(10).toUpperCase()}`;
    const createdProcedure = new this.projectModel({
      account: account._id,
      code,
      ...projectDto,
      requirements: [
        {
          name: 'Certificación POA',
        },
        {
          name: 'Certificación Presupuestaria',
        },
        {
          name: 'Derecho Propietario',
        },
        {
          name: 'Certificacion uso de suelo',
        },
        {
          name: 'Licensia ambiental',
        },
      ],
    });
    return await createdProcedure.save();
  }

  async update(id: string, procedureDto: UpdateProjectDto) {
    const procedureDB = await this.projectModel.findById(id);
    if (!procedureDB) throw new NotFoundException(`Procedure ${id} not found`);
    return await this.projectModel.findByIdAndUpdate(id, procedureDto, { new: true });
  }

  //   async updateDocuments(id: string, { index, properties }: UpdatedDocumentProcurementDto) {
  //     const procedure = await this.projectModel.findByIdAndUpdate(
  //       id,
  //       {
  //         $set: { [`documents.${index}`]: properties },
  //       },
  //       { new: true },
  //     );
  //     return procedure.documents[index];
  //   }

  async getDetail(id: string) {
    const project = await this.projectModel.findById(id).populate('account');
    if (!project) throw new NotFoundException(`Procedure ${id} not found`);
    const procedures = await this.procedureModel
      .find({ project: id })
      .select({ code: 1, reference: 1, state: 1, createdAt: 1 })
      .lean();
    return { ...project.toObject(), procedures };
  }

  async confirmRequirement(projectId: string, index: number, account: Account) {
    const project = await this.projectModel.findById(projectId);

    if (!project) throw new NotFoundException();

    const req = project.requirements[index];
    if (!req) throw new BadRequestException('Requisito no existe');

    req.completed = !req.completed;
    req.officer = account.officer.fullName;
    req.date = new Date();

    await project.save();
    return { completed: req.completed, officer: account.officer.fullName, date: req.date };
  }

  async searchProjects(term: string) {
    const regex = new RegExp(term, 'i');
    return await this.projectModel
      .find({
        $or: [{ code: regex }, { name: regex }],
      })
      .limit(10)
      .lean();
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import { CreateRoleDto, UpdateRoleDto } from '../dtos';
import { PaginationDto } from 'src/modules/common';
import { Role } from '../schemas';


@Injectable()
export class RoleService {
  constructor(@InjectModel(Role.name) private roleModel: Model<Role>) {}

  async findAll({ limit, offset, term }: PaginationDto) {
    const query: FilterQuery<Role> = {
      ...(term && { name: new RegExp(term, 'i') }),
    };
    const [roles, length] = await Promise.all([
      this.roleModel.find(query).lean().limit(limit).skip(offset).sort({ _id: 'descending' }),
      this.roleModel.count(query),
    ]);
    return { roles, length };
  }

  async create(role: CreateRoleDto) {
    const createdRole = new this.roleModel(role);
    return await createdRole.save();
  }

  async update(id: string, role: UpdateRoleDto) {
    return await this.roleModel.findByIdAndUpdate(id, role, { new: true });
  }

  async getActiveRoles() {
    return await this.roleModel.find({});
  }
}

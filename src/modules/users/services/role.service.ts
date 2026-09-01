import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, Types } from 'mongoose';

import { CreateRoleDto, UpdateRoleDto } from '../dtos';
import { PaginationDto } from 'src/modules/common';
import { areValidPermissions, Role } from '../schemas';

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
    this.validatePermissions(role.permissions);
    const createdRole = new this.roleModel(role);
    try {
      return await createdRole.save();
    } catch (error) {
      if (error?.code === 11000) throw new BadRequestException(`El rol ${role.name} ya existe`);
      throw error;
    }
  }

  async update(id: string, role: UpdateRoleDto) {
    if (role.permissions) this.validatePermissions(role.permissions);
    const current = await this.roleModel.exists({ _id: id });
    if (!current) throw new NotFoundException(`Role ${id} not found`);
    try {
      const updated = await this.roleModel.findByIdAndUpdate(id, role, { new: true, runValidators: true });
      return updated;
    } catch (error) {
      if (error?.code === 11000) throw new BadRequestException(`El rol ${role.name} ya existe`);
      throw error;
    }
  }

  async getAll() {
    return await this.roleModel.find().sort({ name: 1 });
  }

  async requireRole(id: string, session?: ClientSession) {
    const role = await this.roleModel.findById(id, null, session ? { session } : undefined);
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async requireRoles(ids: string[], session?: ClientSession) {
    if (!ids.length) return [];
    const uniqueIds = [...new Set(ids)];
    const roles = await this.roleModel.find(
      { _id: { $in: uniqueIds.map((id) => new Types.ObjectId(id)) } },
      null,
      session ? { session } : undefined,
    );
    if (roles.length !== uniqueIds.length) throw new NotFoundException('One or more roles do not exist');
    return roles;
  }

  private validatePermissions(permissions: CreateRoleDto['permissions']) {
    if (!areValidPermissions(permissions)) {
      throw new BadRequestException('Permissions contain duplicated resources or invalid actions');
    }
  }
}

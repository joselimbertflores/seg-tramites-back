import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model } from 'mongoose';

import { CreateRoleDto, UpdateRoleDto } from '../dtos';
import { PaginationDto } from 'src/modules/common';
import { areValidPermissions, Role, RoleContext } from '../schemas';

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
    const current = await this.roleModel.findById(id);
    if (!current) throw new NotFoundException(`Role ${id} not found`);
    if (role.context && role.context !== current.context) {
      throw new BadRequestException('Role context cannot be changed after creation');
    }
    try {
      const updated = await this.roleModel.findByIdAndUpdate(id, role, { new: true, runValidators: true });
      return updated;
    } catch (error) {
      if (error?.code === 11000) throw new BadRequestException(`El rol ${role.name} ya existe`);
      throw error;
    }
  }

  async getRolesByContext(context: RoleContext) {
    return await this.roleModel.find({ context });
  }

  async requireContext(id: string, context: RoleContext, session?: ClientSession) {
    const role = await this.roleModel.findById(id, null, session ? { session } : undefined);
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    if (role.context !== context) {
      throw new BadRequestException(`Role ${role.name} cannot be assigned in ${context} context`);
    }
    return role;
  }

  private validatePermissions(permissions: CreateRoleDto['permissions']) {
    if (!areValidPermissions(permissions)) {
      throw new BadRequestException('Permissions contain duplicated resources or invalid actions');
    }
  }
}

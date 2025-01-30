import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { SYSTEM_RESOURCES, SystemResource } from 'src/modules/auth/constants';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { PaginationDto } from 'src/modules/common';

import { CreateRoleDto, UpdateRoleDto } from '../dtos';
import { RoleService } from '../services';

@Controller('roles')
@ResourceProtected(SystemResource.ROLES)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get('resources')
  getResources() {
    return SYSTEM_RESOURCES;
  }

  @Get()
  findAll(@Query() filterParams: PaginationDto) {
    return this.roleService.findAll(filterParams);
  }

  @Post()
  add(@Body() role: CreateRoleDto) {
    return this.roleService.add(role);
  }

  @Patch(':id')
   edit(@Param('id') id: string, @Body() role: UpdateRoleDto) {
    return  this.roleService.edit(id, role);
  }
}

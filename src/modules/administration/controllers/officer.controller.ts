import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';

import { CreateOfficerDto, UpdateOfficerDto } from '../dtos';
import { OfficerService } from '../services';

@ResourceProtected(SystemResource.OFFICERS)
@Controller('officers')
export class OfficerController {
  constructor(private readonly officerService: OfficerService) {}

  @Get()
  async findAll(@Query() params: PaginationDto) {
    return await this.officerService.findAll(params);
  }

  @Post()
  create(@Body() body: CreateOfficerDto) {
    return this.officerService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() officer: UpdateOfficerDto) {
    return this.officerService.edit(id, officer);
  }
}

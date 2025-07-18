import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CreateTypeProcedureDto, UpdateTypeProcedureDto } from '../dtos';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { PaginationDto } from 'src/modules/common';
import { TypeProcedureService } from '../services';

@ResourceProtected(SystemResource.TYPES_PROCEDURES)
@Controller('types-procedures')
export class TypeProcedureController {
  constructor(private readonly typeProcedureService: TypeProcedureService) {}

  @Get('segments')
  getSegments() {
    return this.typeProcedureService.getSegments();
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.typeProcedureService.findAll(paginationDto);
  }

  @Post()
  create(@Body() typeProcedure: CreateTypeProcedureDto) {
    return this.typeProcedureService.create(typeProcedure);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() typeProcedure: UpdateTypeProcedureDto,
  ) {
    return this.typeProcedureService.update(id, typeProcedure);
  }
}

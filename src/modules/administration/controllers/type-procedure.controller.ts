import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { TypeProcedureService } from '../services/type-procedure.service';
import { CreateTypeProcedureDto, UpdateTypeProcedureDto } from '../dtos';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { PaginationDto } from 'src/modules/common';

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

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() typeProcedure: UpdateTypeProcedureDto,
  ) {
    return this.typeProcedureService.update(id, typeProcedure);
  }
}

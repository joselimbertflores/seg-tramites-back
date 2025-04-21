import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { Account } from 'src/modules/administration/schemas';

import { CreateExternalProcedureDto, UpdateExternalProcedureDto } from '../dtos';
import { IsMongoidPipe, PaginationDto } from 'src/modules/common';
import { SystemResource } from 'src/modules/auth/constants';

import { TypeProcedureService } from 'src/modules/administration/services';
import { ExternalService } from '../services';

import { GetAccountRequest, onlyAssignedAccount } from 'src/modules/administration/decorators';
import { ResourceProtected } from 'src/modules/auth/decorators';

@onlyAssignedAccount()
@ResourceProtected(SystemResource.EXTERNAL)
@Controller('external')
export class ExternalController {
  constructor(
    private readonly externalService: ExternalService,
    private readonly typeProcedure: TypeProcedureService,
  ) {}

  @Get('segments')
  getSegments() {
    return this.typeProcedure.getSegments('EXTERNO');
  }

  @Get('types-procedures/:segment')
  getTypesProceduresBySegment(@Param('segment') segment: string) {
    return this.typeProcedure.getEnabledTypesBySegment(segment, 'EXTERNO');
  }

  @Get()
  findAll(@GetAccountRequest('_id') accountId: string, @Query() paginationDto: PaginationDto) {
    return this.externalService.findAll(paginationDto, accountId);
  }

  @Post()
  create(@GetAccountRequest() account: Account, @Body() procedureDto: CreateExternalProcedureDto) {
    return this.externalService.create(procedureDto, account);
  }

  @Patch(':id')
  update(@Param('id', IsMongoidPipe) procedureId: string, @Body() procedureDto: UpdateExternalProcedureDto) {
    return this.externalService.update(procedureId, procedureDto);
  }
}

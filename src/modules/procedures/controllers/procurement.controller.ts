import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { Account } from 'src/modules/administration/schemas';
import { ProcurementService } from '../services';
import { CreateProcurementProcedureDto, UpdatedDocumentProcurementDto, UpdateProcurementProcedureDto } from '../dtos';
import { IsMongoidPipe, PaginationDto } from 'src/modules/common';
import { GetAccountRequest, onlyAssignedAccount } from 'src/modules/administration/decorators';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';

@onlyAssignedAccount()
// @ResourceProtected(SystemResource.PROCUREMENT)
@Controller('procurement')
export class ProcurementController {
  constructor(private procurementService: ProcurementService) {}

  @Get()
  findAll(@GetAccountRequest('_id') accountId: string, @Query() paginationDto: PaginationDto) {
    return this.procurementService.findAll(paginationDto, accountId);
  }

  @Post()
  create(@GetAccountRequest() account: Account, @Body() procedureDto: CreateProcurementProcedureDto) {
    return this.procurementService.create(procedureDto, account);
  }

  @Patch(':id')
  update(@Param('id', IsMongoidPipe) procedureId: string, @Body() procedureDto: UpdateProcurementProcedureDto) {
    return this.procurementService.update(procedureId, procedureDto);
  }

  @Patch('documents/:id')
  updateDocuments(@Param('id', IsMongoidPipe) procedureId: string, @Body() documentDto: UpdatedDocumentProcurementDto) {
    return this.procurementService.updateDocuments(procedureId, documentDto);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProcurementService } from '../services';
import { GetAccountRequest } from '../../administration/decorators/get-account-request.decorator';
import { onlyAssignedAccount } from '../../administration/decorators/only-assigned-account.decorator';
import { Account } from 'src/modules/administration/schemas';
import { CreateProcurementProcedureDto, UpdatedDocumentProcurementDto, UpdateProcurementProcedureDto } from '../dtos';
import { PaginationDto } from 'src/modules/common';

@onlyAssignedAccount()
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
  update(@Param('id') procedureId: string, @Body() procedureDto: UpdateProcurementProcedureDto) {
    return this.procurementService.update(procedureId, procedureDto);
  }

  @Patch('documents/:id')
  updateDocuments(@Param('id') procedureId: string, @Body() documentDto: UpdatedDocumentProcurementDto) {
    return this.procurementService.updateDocuments(procedureId, documentDto);
  }

  @Get(':id')
  getDetail(@Param('id') procedureId: string) {
    return this.procurementService.getDetail(procedureId);
  }
}

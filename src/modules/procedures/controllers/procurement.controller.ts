import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProcurementService } from '../services';
import { GetAccountRequest } from '../decorators/get-account-request.decorator';
import { onlyAssignedAccount } from '../decorators/only-assigned-account.decorator';
import { PaginationDto } from 'src/modules/common';
import { Account } from 'src/modules/administration/schemas';
import { CreateProcurementProcedureDto, UpdateProcurementProcedureDto } from '../dtos';

@onlyAssignedAccount()
@Controller('procurement')
export class ProcurementController {
  constructor(private procurementService: ProcurementService) {}

  @Get()
  findAll(@GetAccountRequest('_id') accountId: string, @Query() PaginationDto: PaginationDto) {
    return this.procurementService.findAll(PaginationDto, accountId);
  }

  @Post()
  create(@GetAccountRequest() account: Account, @Body() procedureDto: CreateProcurementProcedureDto) {
    return this.procurementService.create(procedureDto, account);
  }

  @Patch(':id')
  update(@Param('id') procedureId: string, @Body() procedureDto: UpdateProcurementProcedureDto) {
    return this.procurementService.update(procedureId, procedureDto);
  }

  @Get(':id')
  getDetail(@Param('id') procedureId: string) {
    return this.procurementService.getDetail(procedureId);
  }
}

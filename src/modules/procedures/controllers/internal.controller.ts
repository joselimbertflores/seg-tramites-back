import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ResourceProtected } from 'src/modules/auth/decorators';

import { InternalService } from '../services';
import { AccountService, TypeProcedureService } from 'src/modules/administration/services';
import { SystemResource } from 'src/modules/auth/constants';
import { Account } from 'src/modules/administration/schemas';
import { onlyAssignedAccount } from '../decorators/only-assigned-account.decorator';
import { GetAccountRequest } from '../decorators/get-account-request.decorator';
import { CreateInternalProcedureDto, UpdateInternalProcedureDto } from '../dtos';
import { IsMongoidPipe, PaginationDto } from 'src/common';

@ResourceProtected(SystemResource.INTERNAL)
@onlyAssignedAccount()
@Controller('internal')
export class InternalController {
  constructor(
    private readonly accountService: AccountService,
    private readonly internalService: InternalService,
    private readonly typeProcedureService: TypeProcedureService,
  ) {}

  @Get('types-procedures')
  async getTypesProcedures() {
    return await this.typeProcedureService.getEnabledTypesByGroup('INTERNO');
  }

  @Get('participant/:text')
  findParticipantForProcess(@Param('text') text: string) {
    return this.accountService.searchActiveAccounts(text);
  }

  @Get()
  findAll(@GetAccountRequest('_id') accountId: string, @Query() PaginationDto: PaginationDto) {
    return this.internalService.findAll(PaginationDto, accountId);
  }

  @Post()
  create(@GetAccountRequest() account: Account, @Body() procedureDto: CreateInternalProcedureDto) {
    return this.internalService.create(procedureDto, account);
  }

  @Patch(':id')
  update(@Param('id') procedureId: string, @Body() procedureDto: UpdateInternalProcedureDto) {
    return this.internalService.update(procedureId, procedureDto);
  }

  @Get(':id')
  getOne(@Param('id', IsMongoidPipe) procedureId: string) {
    return this.internalService.getOne(procedureId);
  }
}

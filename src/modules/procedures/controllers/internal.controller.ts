import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { InternalService } from '../services';
import { AccountService } from 'src/modules/administration/services';
import { SystemResource } from 'src/modules/auth/constants';
import { Account } from 'src/modules/administration/schemas';

import { CreateInternalProcedureDto, UpdateInternalProcedureDto } from '../dtos';
import { AccountProtected, GetAccountRequest } from 'src/modules/administration/decorators';
import { IsMongoidPipe, PaginationDto } from 'src/modules/common';

@AccountProtected(SystemResource.INTERNAL)
@Controller('internal')
export class InternalController {
  constructor(private readonly accountService: AccountService, private readonly internalService: InternalService) {}

  @Get('participant/:text')
  findParticipantForProcess(@Param('text') text: string) {
    return this.accountService.searchActiveAccounts(text);
  }

  @Get()
  findAll(@GetAccountRequest('_id') accountId: string, @Query() paginationParams: PaginationDto) {
    return this.internalService.findAll(paginationParams, accountId);
  }

  @Post()
  create(@GetAccountRequest() account: Account, @Body() procedureDto: CreateInternalProcedureDto) {
    return this.internalService.create(procedureDto, account);
  }

  @Patch(':id')
  update(@Param('id', IsMongoidPipe) id: string, @Body() procedureDto: UpdateInternalProcedureDto) {
    return this.internalService.update(id, procedureDto);
  }
}

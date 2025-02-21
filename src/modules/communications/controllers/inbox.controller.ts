import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';

import { InstitutionService, DependencieService } from 'src/modules/administration/services';
import { AccountService } from 'src/modules/administration/services';
import { Account } from 'src/modules/administration/schemas';
import { IsMongoidPipe } from 'src/modules/common';

import { GetAccountRequest, onlyAssignedAccount } from 'src/modules/procedures/decorators';
import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';
import { InboxService } from '../services';

@Controller('communication')
@onlyAssignedAccount()
export class InboxController {
  constructor(
    private institutionService: InstitutionService,
    private dependencieService: DependencieService,
    private accountService: AccountService,
    private inboxService: InboxService,
  ) {}

  @Get('institutions')
  getInstitutions() {
    return this.institutionService.getActiveInstitutions();
  }

  @Get('dependencies/:institutionId')
  getDependencies(@Param('institutionId', IsMongoidPipe) institutionId: string) {
    return this.dependencieService.getActiveDependenciesOfInstitution(institutionId);
  }

  @Get('recipients/:term')
  searchRecipients(@GetAccountRequest('_id') accountId: string, @Param('term') term: string) {
    return this.accountService.searchRecipients(accountId, term);
  }

  @Get('inbox')
  getInbox(@GetAccountRequest('_id') accountId: string, @Query() queryParams: FilterInboxDto) {
    return this.inboxService.findAll(accountId, queryParams);
  }

  @Put('accept')
  accept(@Body() data: SelectedCommunicationsDto) {
    return this.inboxService.accept(data);
  }

  @Put('reject')
  reject(@Body() data: RejectCommunicationDto, @GetAccountRequest() account: Account) {
    return this.inboxService.reject(account, data);
  }

  @Get('/:id')
  getOne(@Param('id', IsMongoidPipe) communicationId: string, @GetAccountRequest() account: Account) {
    return this.inboxService.getOne(communicationId, account);
  }
}

import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';

import { GetAccountRequest, OnlyAssignedAccount } from 'src/modules/administration/decorators';
import { InstitutionService, DependencieService } from 'src/modules/administration/services';
import { AccountService } from 'src/modules/administration/services';
import { Account } from 'src/modules/administration/schemas';
import { SystemResource } from 'src/modules/auth/constants';
import { RequirePermission } from 'src/modules/auth/decorators';
import { IsMongoidPipe } from 'src/modules/common';
import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';
import { InboxService } from '../services';

@OnlyAssignedAccount()
@RequirePermission([SystemResource.EXTERNAL, SystemResource.INTERNAL, SystemResource.PROCUREMENT])
@Controller('inbox')
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
  accept(@GetAccountRequest() account: Account, @Body() data: SelectedCommunicationsDto) {
    return this.inboxService.accept(account, data);
  }

  @Put('reject')
  reject(@GetAccountRequest() account: Account, @Body() data: RejectCommunicationDto) {
    return this.inboxService.reject(account, data);
  }

  @Get('/:id')
  getOne(@Param('id', IsMongoidPipe) id: string, @GetAccountRequest() account: Account) {
    return this.inboxService.getOne(id, account);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { InstitutionService, DependencieService } from 'src/modules/administration/services';
import { GroupwareGateway } from 'src/modules/groupware/groupware.gateway';

import { IsMongoidPipe, PaginationDto } from 'src/common';
import { AccountService } from 'src/modules/administration/services/account.service';
import { Account } from 'src/modules/administration/schemas';
import { onlyAssignedAccount } from '../../procedures/decorators/only-assigned-account.decorator';
import { GetAccountRequest } from '../../procedures/decorators/get-account-request.decorator';
import { CreateCommunicationDto } from '../dtos/communication.dto';
import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';
import { CommunicationService } from '../services';

@Controller('communication')
@onlyAssignedAccount()
export class CommunicationController {
  constructor(
    private institutionService: InstitutionService,
    private dependencieService: DependencieService,
    private groupwareGateway: GroupwareGateway,
    private inboxService: CommunicationService,
    private accountService: AccountService,
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

  @Post()
  async create(@GetAccountRequest() account: Account, @Body() communication: CreateCommunicationDto) {
    const communications = await this.inboxService.create(communication, account);
    this.groupwareGateway.sentCommunications(communications);
    return communications;
  }

  @Get('inbox')
  getInbox(@GetAccountRequest('_id') accountId: string, @Query() queryParams: FilterInboxDto) {
    console.log(queryParams);
    return this.inboxService.getInbox(accountId, queryParams);
  }

  @Get('outbox')
  getOutbox(@GetAccountRequest('_id') accountId: string, @Query() queryParams: PaginationDto) {
    return this.inboxService.getOutbox(accountId, queryParams);
  }

  @Put('accept')
  accept(@Body() data: SelectedCommunicationsDto) {
    return this.inboxService.accept(data);
  }

  @Put('reject')
  reject(@Body() data: RejectCommunicationDto, @GetAccountRequest() account: Account) {
    return this.inboxService.reject(account, data);
  }

  @Delete('outbox')
  async cancel(@GetAccountRequest() account: Account, @Body() communicationDto: SelectedCommunicationsDto) {
    const result = await this.inboxService.cancel(account, communicationDto);
    this.groupwareGateway.cancelCommunications(result);
    return { message: `Envios cancelados: ${result.length}` };
  }

  @Get('/:id')
  getOne(@Param('id', IsMongoidPipe) communicationId: string, @GetAccountRequest() account: Account) {
    return this.inboxService.getOne(communicationId, account);
  }
}

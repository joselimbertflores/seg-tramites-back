import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { InstitutionService, DependencieService } from 'src/modules/administration/services';
import { GroupwareGateway } from 'src/modules/groupware/groupware.gateway';

import { IsMongoidPipe, PaginationDto } from 'src/modules/common';
import { AccountService } from 'src/modules/administration/services/account.service';
import { Account } from 'src/modules/administration/schemas';
import { onlyAssignedAccount } from '../../procedures/decorators/only-assigned-account.decorator';
import { GetAccountRequest } from '../../procedures/decorators/get-account-request.decorator';
import { CreateCommunicationDto, ForwardCommunicationDto, ResendCommunicationDto } from '../dtos/communication.dto';
import { FilterInboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';
import { CommunicationService as InboxService, OutboxService } from '../services';

@Controller('communication')
@onlyAssignedAccount()
export class CommunicationController {
  constructor(
    private institutionService: InstitutionService,
    private dependencieService: DependencieService,
    private accountService: AccountService,
    private groupwareGateway: GroupwareGateway,
    private inboxService: InboxService,
    private outboxService: OutboxService,
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

  @Post('initiate')
  async initiateCommunication(@GetAccountRequest() account: Account, @Body() communication: CreateCommunicationDto) {
    console.log(communication);
    const communications = await this.outboxService.initiateCommunication(account, communication);
    // this.groupwareGateway.sentCommunications(communications);
    return communications;
  }

  @Post('forward')
  async forwardCommunication(@GetAccountRequest() account: Account, @Body() communication: ForwardCommunicationDto) {
    const communications = await this.outboxService.forwardCommunication(account, communication);
    // this.groupwareGateway.sentCommunications(communications);
    return communications;
  }

  @Post('resend')
  async resendCommunication(@GetAccountRequest() account: Account, @Body() communication: ResendCommunicationDto) {
    const communications = await this.outboxService.resendCommunication(account, communication);
    // this.groupwareGateway.sentCommunications(communications);
    return communications;
  }

  @Get('inbox')
  getInbox(@GetAccountRequest('_id') accountId: string, @Query() queryParams: FilterInboxDto) {
    return this.inboxService.getInbox(accountId, queryParams);
  }

  @Get('outbox')
  getOutbox(@GetAccountRequest('_id') accountId: string, @Query() queryParams: PaginationDto) {
    return this.outboxService.findAll(accountId, queryParams);
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
    const result = await this.outboxService.cancel(account, communicationDto);
    this.groupwareGateway.cancelCommunications(result);
    return { message: `Envios cancelados: ${result.length}` };
  }

  @Get('/:id')
  getOne(@Param('id', IsMongoidPipe) communicationId: string, @GetAccountRequest() account: Account) {
    return this.inboxService.getOne(communicationId, account);
  }
}

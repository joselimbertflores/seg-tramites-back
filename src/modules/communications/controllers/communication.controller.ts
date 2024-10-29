import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { InstitutionService, DependencieService } from 'src/modules/administration/services';
import { GroupwareGateway } from 'src/modules/groupware/groupware.gateway';
import { InboxService, OutboxService } from '../../procedures/services';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { CancelMailsDto, GetInboxParamsDto, UpdateCommunicationDto } from '../../procedures/dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

import { SystemResource } from 'src/modules/auth/constants';
import { IsMongoidPipe } from 'src/common/pipes';
import { AccountService } from 'src/modules/administration/services/account.service';
import { Account } from 'src/modules/administration/schemas';
import { onlyAssignedAccount } from '../../procedures/decorators/only-assigned-account.decorator';
import { GetAccountRequest } from '../../procedures/decorators/get-account-request.decorator';
import { CreateCommunicationDto } from '../dtos/communication.dto';
import { CancelCommunicationDto, RejectCommunicationDto } from '../dtos';

@Controller('communication')
@onlyAssignedAccount()
export class CommunicationController {
  constructor(
    private readonly accountService: AccountService,
    private readonly institutionService: InstitutionService,
    private readonly dependencieService: DependencieService,
    private readonly groupwareGateway: GroupwareGateway,
    private readonly inboxService: InboxService,
    private readonly outboxService: OutboxService,
  ) {}

  @Get('institutions')
  getInstitutions() {
    return this.institutionService.getActiveInstitutions();
  }

  @Get('dependencies/:id_institution')
  async getDependencies(@Param('id_institution', IsMongoidPipe) id_institution: string) {
    return await this.dependencieService.getActiveDependenciesOfInstitution(id_institution);
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
  getInbox(@GetAccountRequest('_id') id_account: string, @Query() params: GetInboxParamsDto) {
    return this.inboxService.findAll(id_account, params);
  }

  @Get('outbox')
  getOutbox(@GetAccountRequest('_id') id_account: string, @Query() paginationParams: PaginationDto) {
    return this.outboxService.findAll(id_account, paginationParams);
  }

  @Put('accept/:id')
  acept(@Param('id', IsMongoidPipe) communicationId: string) {
    return this.inboxService.accept(communicationId);
  }

  @Put('reject/:id')
  reject(
    @Param('id', IsMongoidPipe) id: string,
    @Body() data: RejectCommunicationDto,
    @GetAccountRequest() account: Account,
  ) {
    return this.inboxService.reject(id, account, data);
  }

  @Delete('outbox')
  async cancel(@GetAccountRequest() account: Account, @Body() communicationDto: CancelCommunicationDto) {
    const { message, communications } = await this.outboxService.cancel(account, communicationDto);
    // this.groupwareGateway.cancelMails(mails);
    return { message };
  }

  @Get('/:id')
  getMailDetails(@Param('id', IsMongoidPipe) id_mail: string, @GetAccountRequest() account: Account) {
    return this.inboxService.getMailDetails(id_mail, account);
  }

  @Get('inbox/search/:text')
  searchInbox(
    @GetAccountRequest('_id') id_account: string,
    @Param('text') text: string,
    @Query() params: GetInboxParamsDto,
  ) {
    return this.inboxService.search(id_account, text, params);
  }

  @Get('outbox/search/:text')
  searchOutbox(
    @GetAccountRequest('_id') id_account: string,
    @Param('text') text: string,
    @Query() PaginationDto: PaginationDto,
  ) {
    return this.outboxService.search(id_account, text, PaginationDto);
  }
}

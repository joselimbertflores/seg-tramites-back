import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { InstitutionService, DependencieService } from 'src/modules/administration/services';
import { GroupwareGateway } from 'src/modules/groupware/groupware.gateway';
import { CommunicationService } from '../../procedures/services';
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
import { FilterInboxDto, FilterOutboxDto, RejectCommunicationDto, SelectedCommunicationsDto } from '../dtos';

@Controller('communication')
@onlyAssignedAccount()
export class CommunicationController {
  constructor(
    private readonly accountService: AccountService,
    private readonly institutionService: InstitutionService,
    private readonly dependencieService: DependencieService,
    private readonly groupwareGateway: GroupwareGateway,
    private readonly inboxService: CommunicationService,
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
  getInbox(@GetAccountRequest('_id') accountId: string, @Query() queryParams: FilterInboxDto) {
    return this.inboxService.getInbox(accountId, queryParams);
  }

  @Get('outbox')
  getOutbox(@GetAccountRequest('_id') accountId: string, @Query() queryParams: FilterOutboxDto) {
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
    const { message, communications } = await this.inboxService.cancel(account, communicationDto);
    // this.groupwareGateway.cancelMails(mails);
    return { message };
  }

  @Get('/:id')
  getMailDetails(@Param('id', IsMongoidPipe) id_mail: string, @GetAccountRequest() account: Account) {
    return this.inboxService.getMailDetails(id_mail, account);
  }
}

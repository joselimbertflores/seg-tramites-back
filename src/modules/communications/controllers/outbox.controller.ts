import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';

import { AccountProtected, GetAccountRequest } from 'src/modules/administration/decorators';
import { GroupwareGateway } from 'src/modules/groupware/gateways/groupware.gateway';
import { Account } from 'src/modules/administration/schemas';
import { SystemResource } from 'src/modules/auth/constants';
import { PaginationDto } from 'src/modules/common';
import { OutboxService } from '../services';
import { CreateCommunicationDto, ReplyCommunicationDto, SelectedCommunicationsDto } from '../dtos';

@Controller('outbox')
@AccountProtected([SystemResource.EXTERNAL, SystemResource.INTERNAL, SystemResource.PROCUREMENT])
export class OutboxController {
  constructor(private outboxService: OutboxService, private groupwareGateway: GroupwareGateway) {}

  @Get()
  getOutbox(@GetAccountRequest('_id') accountId: string, @Query() queryParams: PaginationDto) {
    return this.outboxService.findAll(accountId, queryParams);
  }

  @Post('initiate')
  async initiateCommunication(@GetAccountRequest() account: Account, @Body() communication: CreateCommunicationDto) {
    const communications = await this.outboxService.initiateCommunication(account, communication);
    this.groupwareGateway.sentCommunications(communications);
    return communications.map(({ communication }) => communication);
  }

  @Post('forward')
  async forwardCommunication(@GetAccountRequest() account: Account, @Body() communication: ReplyCommunicationDto) {
    const communications = await this.outboxService.forwardCommunication(account, communication);
    this.groupwareGateway.sentCommunications(communications);
    return communications.map(({ communication }) => communication);
  }

  @Post('resend')
  async resendCommunication(@GetAccountRequest() account: Account, @Body() communication: ReplyCommunicationDto) {
    const communications = await this.outboxService.resendCommunication(account, communication);
    this.groupwareGateway.sentCommunications(communications);
    return communications.map(({ communication }) => communication);
  }

  @Delete()
  async cancel(@GetAccountRequest() account: Account, @Body() communicationDto: SelectedCommunicationsDto) {
    const { canceledCommunications, ...result } = await this.outboxService.cancel(account, communicationDto);
    this.groupwareGateway.cancelCommunications(canceledCommunications);
    return result;
  }
}

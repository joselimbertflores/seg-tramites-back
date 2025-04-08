import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';

import { GetAccountRequest } from 'src/modules/administration/decorators/get-account-request.decorator';
import { onlyAssignedAccount } from 'src/modules/administration/decorators';
import { GroupwareGateway } from 'src/modules/groupware/groupware.gateway';
import { Account } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/modules/common';
import { OutboxService } from '../services';
import {
  CreateCommunicationDto,
  ResendCommunicationDto,
  ForwardCommunicationDto,
  SelectedCommunicationsDto,
} from '../dtos';

@Controller('outbox')
@onlyAssignedAccount()
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
  async forwardCommunication(@GetAccountRequest() account: Account, @Body() communication: ForwardCommunicationDto) {
    const communications = await this.outboxService.forwardCommunication(account, communication);
    this.groupwareGateway.sentCommunications(communications);
    return communications.map(({ communication }) => communication);
  }

  @Post('resend')
  async resendCommunication(@GetAccountRequest() account: Account, @Body() communication: ResendCommunicationDto) {
    const communications = await this.outboxService.resendCommunication(account, communication);
    this.groupwareGateway.sentCommunications(communications);
    return communications.map(({ communication }) => communication);
  }

  @Delete()
  async cancel(@GetAccountRequest() account: Account, @Body() communicationDto: SelectedCommunicationsDto) {
    const { items, ...result } = await this.outboxService.cancel(account, communicationDto);
    this.groupwareGateway.cancelCommunications(items);
    return result;
  }
}

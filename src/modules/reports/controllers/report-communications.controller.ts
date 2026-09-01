import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';

import { GetAccountRequest, OnlyAssignedAccount } from 'src/modules/administration/decorators';
import { IsMongoidPipe } from 'src/modules/common';
import { RequirePermission } from 'src/modules/auth/decorators';
import { Account } from 'src/modules/administration/schemas';
import { SystemResource } from 'src/modules/auth/constants';

import {
  GetCommunicationHistoryDto,
  GetTotalCommunicationsByUnit,
  GetCorrespondenceByAccountDto,
  PaginationReportDto,
} from '../dtos';
import { ReportCommunicationsService } from '../services';
import { reportType } from '../enums/report-types.enum';

@Controller('report-communications')
export class ReportCommunicationsController {
  constructor(private reportService: ReportCommunicationsService) {}

  @HttpCode(HttpStatus.OK)
  @RequirePermission(SystemResource.REPORTS, reportType.UNIT)
  @Post('unit/:dependencyId')
  getTotalByUnit(
    @Param('dependencyId', IsMongoidPipe) dependencyId: string,
    @Body() body: GetTotalCommunicationsByUnit,
  ) {
    return this.reportService.getTotalByUnit(body, dependencyId);
  }

  @HttpCode(HttpStatus.OK)
  @OnlyAssignedAccount()
  @RequirePermission(SystemResource.REPORTS, reportType.HISTORY)
  @Post('history')
  getHistory(
    @GetAccountRequest() account: Account,
    @Query() queryParams: PaginationReportDto,
    @Body() rangeProps: GetCommunicationHistoryDto,
  ) {
    return this.reportService.getHistory(account.id, queryParams, rangeProps);
  }

  @HttpCode(HttpStatus.OK)
  @OnlyAssignedAccount()
  @RequirePermission(SystemResource.REPORTS, reportType.UNLINK)
  @Get('unlink')
  getUnlinkData(@GetAccountRequest() account: Account) {
    return this.reportService.getUnlinkData(account);
  }

  @RequirePermission(SystemResource.ACCOUNTS, 'read')
  @Get('tray-status/:accountId')
  getAccountTrayStatus(@Param('accountId') accountId: string) {
    return this.reportService.getAccountTrayStatus(accountId);
  }

  @HttpCode(HttpStatus.OK)
  @OnlyAssignedAccount()
  @RequirePermission(SystemResource.REPORTS, reportType.UNIT_CORRESPONDENCE_STATUS)
  @Post('correspondence-status')
  getCorrespondenceStatusByUnit(@GetAccountRequest() account: Account, @Body() body: GetCorrespondenceByAccountDto) {
    return this.reportService.getCorrespondenceStatusByUnit(body, account.dependencia._id);
  }

  @HttpCode(HttpStatus.OK)
  @RequirePermission(SystemResource.REPORTS, reportType.UNIT_CORRESPONDENCE_STATUS)
  @Get('inbox/:accountId')
  getCorrespondenceByAccount(
    @Param('accountId', IsMongoidPipe) accountId: string,
    @Query() queryParams: GetCorrespondenceByAccountDto,
  ) {
    return this.reportService.getCorrespondenceByAccount(accountId, queryParams);
  }
}

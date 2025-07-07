import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';

import { RequirePermissions } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { ReportCommunicationsService } from '../services';
import { GetCommunicationHistoryDto, GetTotalCommunicationsByUnit, RangeReportProps } from '../dtos';
import { IsMongoidPipe, PaginationDto } from 'src/modules/common';
import { reportType } from '../report-types.enum';
import { GetAccountRequest, onlyAssignedAccount } from 'src/modules/administration/decorators';
import { Account } from 'src/modules/administration/schemas';

@Controller('report-communications')
export class ReportCommunicationsController {
  constructor(private reportService: ReportCommunicationsService) {}

  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: SystemResource.REPORTS, actions: [reportType.UNIT] })
  @Post('unit/:dependencyId')
  getTotalByUnit(
    @Param('dependencyId', IsMongoidPipe) dependencyId: string,
    @Body() body: GetTotalCommunicationsByUnit,
  ) {
    return this.reportService.getTotalByUnit(body, dependencyId);
  }

  @HttpCode(HttpStatus.OK)
  @RequirePermissions({
    resource: SystemResource.REPORTS,
    actions: [reportType.UNIT],
  })
  @Get('inbox/:accountId')
  getInboxByAccount(@Param('accountId', IsMongoidPipe) accountId: string) {
    return this.reportService.getInboxByAccount(accountId);
  }

  @onlyAssignedAccount()
  @RequirePermissions({
    resource: SystemResource.REPORTS,
    actions: [reportType.UNIT],
  })
  @Post('history')
  getHistory(
    @GetAccountRequest() account: Account,
    @Query() queryParams: PaginationDto,
    @Body() rangeProps: GetCommunicationHistoryDto,
  ) {
    return this.reportService.getHistory(account.id, queryParams, rangeProps);
  }

  @onlyAssignedAccount()
  @Get("unlink")
  getUnlinkData(@GetAccountRequest() account: Account) {
    return this.reportService.getUnlinkData(account);
  }
}

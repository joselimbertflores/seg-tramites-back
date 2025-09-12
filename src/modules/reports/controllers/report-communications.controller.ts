import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';

import { GetAccountRequest, onlyAssignedAccount } from 'src/modules/administration/decorators';
import { IsMongoidPipe, PaginationDto } from 'src/modules/common';
import { RequirePermissions } from 'src/modules/auth/decorators';
import { Account } from 'src/modules/administration/schemas';
import { SystemResource } from 'src/modules/auth/constants';

import { GetCommunicationHistoryDto, GetTotalCommunicationsByUnit, GetCorrespondenceByAccountDto } from '../dtos';
import { ReportCommunicationsService } from '../services';
import { reportType } from '../enums/report-types.enum';

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
  @RequirePermissions({ resource: SystemResource.REPORTS, actions: [reportType.UNIT_CORRESPONDENCE_STATUS] })
  @Get('inbox/:accountId')
  getCorrespondenceByAccount(
    @Param('accountId', IsMongoidPipe) accountId: string,
    @Query() queryParams: GetCorrespondenceByAccountDto,
  ) {
    return this.reportService.getCorrespondenceByAccount(accountId, queryParams);
  }

  @HttpCode(HttpStatus.OK)
  @onlyAssignedAccount()
  @RequirePermissions({
    resource: SystemResource.REPORTS,
    actions: [reportType.HISTORY],
  })
  @Post('history')
  getHistory(
    @GetAccountRequest() account: Account,
    @Query() queryParams: PaginationDto,
    @Body() rangeProps: GetCommunicationHistoryDto,
  ) {
    return this.reportService.getHistory(account.id, queryParams, rangeProps);
  }

  @HttpCode(HttpStatus.OK)
  @onlyAssignedAccount()
  @RequirePermissions({
    resource: SystemResource.REPORTS,
    actions: [reportType.UNLINK],
  })
  @Get('unlink')
  getUnlinkData(@GetAccountRequest() account: Account) {
    return this.reportService.getUnlinkData(account);
  }

  @RequirePermissions({
    resource: SystemResource.ACCOUNTS,
    actions: ['read'],
  })
  @Get('tray-status/:accountId')
  getAccountTrayStatus(@Param('accountId') accountId: string) {
    return this.reportService.getAccountTrayStatus(accountId);
  }

  @HttpCode(HttpStatus.OK)
  @RequirePermissions({
    resource: SystemResource.REPORTS,
    actions: [reportType.UNIT_CORRESPONDENCE_STATUS],
  })
  @Post('correspondence-status/:dependencyId')
  getCorrespondenceStatusByUnit(
    @Param('dependencyId') dependencyId: string,
    @Body() body: GetCorrespondenceByAccountDto,
  ) {
    return this.reportService.getCorrespondenceStatusByUnit(body, dependencyId);
  }
}

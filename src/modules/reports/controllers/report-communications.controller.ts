import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { GetAccountRequest, onlyAssignedAccount } from 'src/modules/administration/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators';
import { Account } from 'src/modules/administration/schemas';
import { SystemResource } from 'src/modules/auth/constants';
import { ReportCommunicationsService } from '../services';
import { GetTotalCommunicationsByUnit } from '../dtos';
import { reportType } from '../report-types.enum';
import { IsMongoidPipe } from 'src/modules/common';

@Controller('report-communications')
export class ReportCommunicationsController {
  constructor(private reportService: ReportCommunicationsService) {}

  @HttpCode(HttpStatus.OK)
  @onlyAssignedAccount()
  @RequirePermissions({ resource: SystemResource.REPORTS, actions: [reportType.UNIT] })
  @Post('dependents')
  getTotalDependents(@Body() body: GetTotalCommunicationsByUnit, @GetAccountRequest() account: Account) {
    return this.reportService.getTotalByUnit(body, account.dependencia.id);
  }

  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: SystemResource.REPORTS, actions: [reportType.UNIT] })
  @Post('unit/:dependencyId')
  getTotalByUnit(
    @Param('depedencyId', IsMongoidPipe) dependencyId: string,
    @Body() body: GetTotalCommunicationsByUnit,
  ) {
    return this.reportService.getTotalByUnit(body, dependencyId);
  }

  @HttpCode(HttpStatus.OK)
  @RequirePermissions({
    resource: SystemResource.REPORTS,
    actions: [reportType.UNIT, reportType.DEPENDENTS],
    match: 'some',
  })
  @Get('inbox/:accountId')
  getInboxByAccount(@Param('accountId', IsMongoidPipe) accountId: string) {
    return this.reportService.getInboxByAccount(accountId);
  }
}

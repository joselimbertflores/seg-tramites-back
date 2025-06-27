import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { RequirePermissions } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { ReportCommunicationsService } from '../services';
import { GetTotalCommunicationsByUnit } from '../dtos';
import { IsMongoidPipe } from 'src/modules/common';
import { reportType } from '../report-types.enum';

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
    actions: [reportType.UNIT, reportType.DEPENDENTS],
    match: 'some',
  })
  @Get('inbox/:accountId')
  getInboxByAccount(@Param('accountId', IsMongoidPipe) accountId: string) {
    return this.reportService.getInboxByAccount(accountId);
  }
}

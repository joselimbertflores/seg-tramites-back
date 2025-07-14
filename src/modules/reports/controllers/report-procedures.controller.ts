import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';

import {
  GetProceduresEficiencyParamsDto,
  SearchProcedureByApplicantDto,
  SearchProcedureDto,
  TotalProceduresBySegmentParamsDto,
} from '../dtos';
import { TypeProcedureService } from 'src/modules/administration/services';
import { RequirePermissions } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { PaginationDto } from 'src/modules/common';
import { ReportProcedureService } from '../services';
import { reportType } from '../enums/report-types.enum';

@Controller('report-procedures')
export class ReportProceduresController {
  constructor(private reportService: ReportProcedureService, private typeProcedureService: TypeProcedureService) {}

  @Get('types-procedures')
  getTypeProcedures(@Query('term') term: string) {
    return this.typeProcedureService.getTypesByText(term);
  }

  @HttpCode(HttpStatus.OK)
  @Post('segments')
  getTotalBySegment(@Body() params: TotalProceduresBySegmentParamsDto) {
    return this.reportService.getTotalBySegment(params);
  }

  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: SystemResource.REPORTS, actions: [reportType.APPLICANT] })
  @Post('applicant')
  searchProcedureByApplicant(@Body() body: SearchProcedureByApplicantDto, @Query() queryParams: PaginationDto) {
    return this.reportService.searchProcedureByApplicant(body, queryParams);
  }

  @HttpCode(HttpStatus.OK)
  // @RequirePermissions({ resource: SystemResource.REPORTS, actions: [reportType.SEARCH] })
  @Post('search')
  searcProcedureByProperties(@Body() body: SearchProcedureDto, @Query() queryParams: PaginationDto) {
    return this.reportService.searchProcedureByProperties(body, queryParams);
  }

  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: SystemResource.REPORTS, actions: [reportType.EFFICIENCY] })
  @Post('eficiency')
  getProceduresEnficiency(@Body() body: GetProceduresEficiencyParamsDto) {
    return this.reportService.getProceduresEnficiency(body);
  }
}

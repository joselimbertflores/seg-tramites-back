import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ReportProcedureService } from '../services';
import { TotalProceduresBySegmentParamsDto } from '../dtos';

@Controller('report-procedures')
export class ReportProceduresController {
  constructor(private reportService: ReportProcedureService) {}

  @HttpCode(HttpStatus.OK)
  @Post('segments')
  getTotalBySegment(@Body() params: TotalProceduresBySegmentParamsDto) {
    return this.reportService.getTotalBySegment(params);
  }
}

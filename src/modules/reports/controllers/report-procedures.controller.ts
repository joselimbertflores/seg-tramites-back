import { Body, Controller, Get, Post } from '@nestjs/common';
import { ReportProcedureService } from '../services';
import { TotalProceduresBySegmentParamsDto } from '../dtos';

@Controller('report-procedures')
export class ReportProceduresController {
  constructor(private reportService: ReportProcedureService) {}

  @Post('segments')
  getTotalBySegment(@Body() params: TotalProceduresBySegmentParamsDto) {
    return this.reportService.getTotalBySegment(params);
  }
}

import { IsOptional, IsString } from 'class-validator';
import { RangeReportProps } from './filter-report-props.dto';

export class GetTotalProceduresByStateDto extends RangeReportProps {
  @IsOptional()
  @IsString()
  institutionId?: string;

}

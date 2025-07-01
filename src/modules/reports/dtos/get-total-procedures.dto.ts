import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RangeReportProps } from './filter-report-props.dto';
import { procedureGroup } from 'src/modules/procedures/schemas';

export class GetTotalProceduresByStateDto extends RangeReportProps {
  @IsOptional()
  @IsString()
  institutionId?: string;
}

export class TotalProceduresBySegmentParamsDto extends RangeReportProps {
  @IsString()
  @IsNotEmpty()
  institutionId: string;

  @IsEnum(procedureGroup)
  group: procedureGroup;
}

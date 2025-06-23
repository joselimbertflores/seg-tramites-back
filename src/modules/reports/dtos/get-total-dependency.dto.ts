import { IsEnum, IsOptional } from 'class-validator';
import { procedureGroup } from 'src/modules/procedures/schemas';
import { RangeReportProps } from './filter-report-props.dto';

export class GetTotalProceduresByUnit extends RangeReportProps {
  @IsEnum(procedureGroup)
  group: procedureGroup;
}

export class GetTotalCommunicationsByUnit extends RangeReportProps {

  @IsEnum(procedureGroup)
  @IsOptional()
  group?: procedureGroup;
}

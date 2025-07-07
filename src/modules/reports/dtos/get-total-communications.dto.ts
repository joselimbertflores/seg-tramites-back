import { IsEnum, IsOptional } from 'class-validator';
import { procedureGroup } from 'src/modules/procedures/schemas';
import { RangeReportProps } from './filter-report-props.dto';
import { PartialType } from '@nestjs/mapped-types';

export class GetTotalCommunicationsByUnit extends RangeReportProps {
  @IsEnum(procedureGroup)
  @IsOptional()
  group?: procedureGroup;
}

export class GetCommunicationHistoryDto extends PartialType(RangeReportProps) {}

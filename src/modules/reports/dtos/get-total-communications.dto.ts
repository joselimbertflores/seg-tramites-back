import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { procedureGroup } from 'src/modules/procedures/schemas';
import { RangeReportProps } from './filter-report-props.dto';

export class GetTotalCommunicationsByUnit extends RangeReportProps {
  @IsEnum(procedureGroup)
  @IsOptional()
  group?: procedureGroup;

  @IsIn(['recipient', 'sender'])
  filterBy: 'recipient' | 'sender';
}

export class GetCommunicationHistoryDto extends RangeReportProps {}

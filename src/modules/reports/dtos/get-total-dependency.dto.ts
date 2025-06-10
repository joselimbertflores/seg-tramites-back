import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsOptional } from 'class-validator';
import { procedureGroup } from 'src/modules/procedures/schemas';

class RangeReportProps {
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;
}

export class GetTotalProceduresByUnit extends RangeReportProps {
  @IsEnum(procedureGroup)
  group: procedureGroup;
}

export class GetTotalCommunicationsByUnit extends RangeReportProps {
  @IsIn(['sender', 'recipient'])
  participant: 'sender' | 'recipient';

  @IsEnum(procedureGroup)
  @IsOptional()
  group?: procedureGroup;
}

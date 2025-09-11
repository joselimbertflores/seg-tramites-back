import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { procedureGroup } from 'src/modules/procedures/schemas';

export class GetCorrespondenceStatusByUnit {
  @IsIn(['recipient', 'sender'])
  filterBy: 'recipient' | 'sender';

  @IsEnum(procedureGroup)
  @IsOptional()
  group: procedureGroup;
}

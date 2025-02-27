import { IsEnum, IsMongoId } from 'class-validator';
import { procedureGroup } from 'src/modules/procedures/schemas';

export class ProcessParamDto {
  @IsEnum(procedureGroup)
  group: procedureGroup;

  @IsMongoId()
  id: string;
}

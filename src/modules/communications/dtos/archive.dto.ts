import { IsIn, IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import { procedureState } from 'src/modules/procedures/schemas';

export class CreateArchiveDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsMongoId()
  folderId: string;

  @IsMongoId()
  communicationId: string;

  @IsIn([procedureState.CONCLUIDO, procedureState.SUSPENDIDO, procedureState.ANULADO])
  state: string;
}

import { ArrayMinSize, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/modules/common';
import { procedureState } from 'src/modules/procedures/schemas';

export class CreateArchiveDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsMongoId()
  @IsOptional()
  folderId?: string;

  @ArrayMinSize(1, { message: 'Ningun elemento seleccionado' })
  @IsMongoId({ each: true })
  ids: string[];

  @IsIn([
    procedureState.CONCLUIDO,
    procedureState.SUSPENDIDO,
    procedureState.ANULADO,
    procedureState.ABANDONO,
    procedureState.RETIRADO,
  ])
  state: procedureState;
}

export class FilterArchiveDto extends PaginationDto {
  @IsMongoId({ message: 'Folder invalido' })
  @IsOptional()
  folder?: string;
}

export class SelectedArchivesDto {
  @ArrayMinSize(1, { message: 'Ningun elemento seleccionado' })
  @IsMongoId({ each: true })
  ids: string[];
}

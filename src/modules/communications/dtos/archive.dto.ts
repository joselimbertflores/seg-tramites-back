import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsDate, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  accountId?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isExport?: boolean = false;
}

export class SelectedArchivesDto {
  @ArrayMinSize(1, { message: 'Ningun elemento seleccionado' })
  @IsMongoId({ each: true })
  ids: string[];
}

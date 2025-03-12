import { Type } from 'class-transformer';
import { IsNotEmpty, IsNotEmptyObject, IsObject, IsString, ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ProcedureDto } from './procedure.dto';

export class Worker {
  @IsString()
  @IsNotEmpty()
  fullname: string;

  @IsString()
  @IsNotEmpty()
  jobtitle: string;
}

export class CreateInternalProcedureDto extends ProcedureDto {
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => Worker)
  sender: Worker;

  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => Worker)
  recipient: Worker;
}
export class UpdateInternalProcedureDto extends PartialType(CreateInternalProcedureDto) {}

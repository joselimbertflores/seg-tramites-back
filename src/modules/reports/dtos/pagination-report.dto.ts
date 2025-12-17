import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';

export class PaginationReportDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9\s-]{1,255}$/, { message: 'El término de búsqueda contiene caracteres no válidos.' })
  readonly term?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  export?: boolean = false;
}

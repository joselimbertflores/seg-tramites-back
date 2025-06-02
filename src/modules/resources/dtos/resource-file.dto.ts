import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class ResourceFileItem {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  originalName: string;
}

export class CreateResourceFileDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toString())
  category: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ResourceFileItem)
  items: ResourceFileItem[];
}

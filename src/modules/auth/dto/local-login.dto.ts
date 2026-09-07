import { IsNotEmpty, IsString } from 'class-validator';
export class LocalLoginDto {
  @IsNotEmpty()
  @IsString()
  login: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

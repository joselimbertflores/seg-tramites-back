import { IsNotEmpty, MinLength } from 'class-validator';
export class UpdateMyUserDto {
  @MinLength(6)
  @IsNotEmpty()
  password: string;
}

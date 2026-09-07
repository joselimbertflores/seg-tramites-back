import { IsNotEmpty, MinLength } from 'class-validator';
export class ChangePasswordDto {
  @MinLength(6)
  @IsNotEmpty()
  password: string;
}

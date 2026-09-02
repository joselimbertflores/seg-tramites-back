import { plainToInstance } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min, validateSync } from 'class-validator';

export class EnvVars {
  @IsString()
  DATABASE_URL: string;

  @IsNumber()
  PORT: number;

  @IsString()
  HOST: string;

  @IsString()
  JWT_KEY: string;

  @IsNumber()
  @Min(1)
  AUTO_REJECT_DAYS: number;

  @IsNumber()
  YEAR: number;

  @IsString()
  MAIL_HOST: string;

  @IsNumber()
  MAIL_PORT: number;

  @IsString()
  MAIL_USER: string;

  @IsString()
  MAIL_PASSWORD: string;

  @IsString()
  @IsOptional()
  IDENTITY_HUB_PUBLIC_URL?: string;

  @IsString()
  @IsOptional()
  IDENTITY_HUB_INTERNAL_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_CLIENT_SECRET?: string;
}

export function validate(config: Record<string, unknown>): EnvVars {
  const validatedConfig = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

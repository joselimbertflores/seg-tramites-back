import { plainToInstance } from 'class-transformer';
import { IsNumber, IsString, Min, validateSync } from 'class-validator';

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
  @Min(24)
  AUTO_REJECT_HOURS: number;
}

export function validate(config: Record<string, unknown>): EnvVars {
  const validatedConfig = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

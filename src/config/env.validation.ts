import * as Joi from 'joi';

export interface EnvVars {
  DATABASE_URL: string;
  PORT: number;
  HOST: string;
  JWT_KEY: string;
  AUTO_REJECT_DAYS: number;
  YEAR: number;
  MAIL_HOST: string;
  MAIL_PORT: number;
  MAIL_USER: string;
  MAIL_PASSWORD: string;
  IDENTITY_HUB_PUBLIC_URL?: string;
  IDENTITY_HUB_INTERNAL_URL?: string;
  OAUTH_CLIENT_ID?: string;
  OAUTH_CLIENT_SECRET?: string;
  RRHH_INTERNAL_URL: string;
  RRHH_ACCESS_TOKEN: string;
}

export const validationSchema = Joi.object<EnvVars>({
  DATABASE_URL: Joi.string().trim().min(1).required(),
  PORT: Joi.number().port().required(),
  HOST: Joi.string().trim().min(1).required(),
  JWT_KEY: Joi.string().min(1).required(),
  AUTO_REJECT_DAYS: Joi.number().integer().min(1).required(),
  YEAR: Joi.number().integer().required(),
  MAIL_HOST: Joi.string().trim().min(1).required(),
  MAIL_PORT: Joi.number().port().required(),
  MAIL_USER: Joi.string().trim().min(1).required(),
  MAIL_PASSWORD: Joi.string().min(1).required(),
  IDENTITY_HUB_PUBLIC_URL: Joi.string().trim().optional(),
  IDENTITY_HUB_INTERNAL_URL: Joi.string().trim().optional(),
  OAUTH_CLIENT_ID: Joi.string().trim().optional(),
  OAUTH_CLIENT_SECRET: Joi.string().optional(),
  RRHH_INTERNAL_URL: Joi.string().trim().uri().required(),
  RRHH_ACCESS_TOKEN: Joi.string().trim().min(1).required(),
});

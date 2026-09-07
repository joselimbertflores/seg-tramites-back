import * as Joi from 'joi';

export interface EnvVars {
  DATABASE_URL: string;
  PORT: number;
  HOST: string;
  NODE_ENV: 'development' | 'test' | 'production';
  SEG_TRAMITES_PUBLIC_URL: string;
  SEG_TRAMITES_UI_URL?: string;
  AUTH_COOKIE_SECURE: boolean;
  AUTH_COOKIE_SAME_SITE: 'lax' | 'strict' | 'none';
  AUTO_REJECT_DAYS: number;
  YEAR: number;
  MAIL_HOST: string;
  MAIL_PORT: number;
  MAIL_USER: string;
  MAIL_PASSWORD: string;
  IDENTITY_HUB_PUBLIC_URL: string;
  IDENTITY_HUB_INTERNAL_URL?: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
  RRHH_INTERNAL_URL: string;
  RRHH_ACCESS_TOKEN: string;
}

const httpUrl = Joi.string()
  .trim()
  .uri({ scheme: ['http', 'https'] });

export const validationSchema = Joi.object<EnvVars>({
  DATABASE_URL: Joi.string().trim().min(1).required(),
  PORT: Joi.number().port().required(),
  HOST: Joi.string().trim().min(1).required(),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  SEG_TRAMITES_PUBLIC_URL: httpUrl.required(),
  SEG_TRAMITES_UI_URL: httpUrl.optional(),
  AUTH_COOKIE_SECURE: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.valid(true).default(true),
    otherwise: Joi.boolean().default(false),
  }),
  AUTH_COOKIE_SAME_SITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('lax')
    .when('AUTH_COOKIE_SECURE', { is: false, then: Joi.invalid('none') }),
  AUTO_REJECT_DAYS: Joi.number().integer().min(1).required(),
  YEAR: Joi.number().integer().required(),
  MAIL_HOST: Joi.string().trim().min(1).required(),
  MAIL_PORT: Joi.number().port().required(),
  MAIL_USER: Joi.string().trim().min(1).required(),
  MAIL_PASSWORD: Joi.string().min(1).required(),
  IDENTITY_HUB_PUBLIC_URL: httpUrl.required(),
  IDENTITY_HUB_INTERNAL_URL: httpUrl.optional(),
  OAUTH_CLIENT_ID: Joi.string().trim().min(1).required(),
  OAUTH_CLIENT_SECRET: Joi.string().min(1).required(),
  RRHH_INTERNAL_URL: Joi.string().trim().uri().required(),
  RRHH_ACCESS_TOKEN: Joi.string().trim().min(1).required(),
});

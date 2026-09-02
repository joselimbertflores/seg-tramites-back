import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';

import { EnvVars } from 'src/config';

export interface IdentityHubAssignableUser {
  externalKey: string;
  relationKey: string | null;
  fullName: string;
  email: string | null;
  login: string;
}

export type IdentityCandidate = Omit<IdentityHubAssignableUser, 'relationKey'>;

@Injectable()
export class IdentityHubUsersClientService {
  private readonly requestTimeoutMs = 10_000;

  constructor(private readonly configService: ConfigService<EnvVars>) {}

  async searchAssignableUsers(term: string): Promise<IdentityCandidate[]> {
    const url = this.buildUrl('/internal/users/assignable');
    url.searchParams.set('term', term.trim());

    try {
      const response = await axios.get<IdentityHubAssignableUser[]>(url.toString(), {
        auth: this.getBasicAuth(),
        timeout: this.requestTimeoutMs,
      });
      return response.data.map((user) => this.toCandidate(user));
    } catch {
      throw new BadGatewayException('No fue posible buscar usuarios asignables en Identity Hub');
    }
  }

  async findAssignableUserByExternalKey(externalKey: string): Promise<IdentityHubAssignableUser> {
    const url = this.buildUrl(`/internal/users/assignable/${encodeURIComponent(externalKey)}`);

    try {
      const response = await axios.get<IdentityHubAssignableUser>(url.toString(), {
        auth: this.getBasicAuth(),
        timeout: this.requestTimeoutMs,
      });
      return this.validateUser(response.data, true);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException('La identidad institucional no está disponible para Seguimiento de Trámites');
      }
      throw new BadGatewayException('No fue posible validar el usuario en Identity Hub');
    }
  }

  private toCandidate(user: IdentityHubAssignableUser): IdentityCandidate {
    const validated = this.validateUser(user, false);
    return {
      externalKey: validated.externalKey,
      fullName: validated.fullName,
      email: validated.email,
      login: validated.login,
    };
  }

  private validateUser(
    user: IdentityHubAssignableUser,
    requireRelationKeyProperty: boolean,
  ): IdentityHubAssignableUser {
    if (requireRelationKeyProperty && !Object.prototype.hasOwnProperty.call(user ?? {}, 'relationKey')) {
      throw new BadGatewayException(
        'Identity Hub no devolvió relationKey en el detalle autoritativo del usuario institucional',
      );
    }

    const hasValidRelationKey =
      (!requireRelationKeyProperty && user?.relationKey === undefined) ||
      user?.relationKey === null ||
      typeof user?.relationKey === 'string';

    if (
      typeof user?.externalKey !== 'string' ||
      user.externalKey.length === 0 ||
      typeof user.fullName !== 'string' ||
      user.fullName.length === 0 ||
      typeof user.login !== 'string' ||
      user.login.length === 0 ||
      (user.email !== null && typeof user.email !== 'string') ||
      !hasValidRelationKey
    ) {
      throw new BadGatewayException('Identity Hub devolvió un usuario institucional inválido');
    }

    return user;
  }

  private buildUrl(path: string): URL {
    const baseUrl =
      this.configService.get('IDENTITY_HUB_INTERNAL_URL') ?? this.configService.getOrThrow('IDENTITY_HUB_PUBLIC_URL');
    return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  }

  private getBasicAuth() {
    return {
      username: this.configService.getOrThrow('OAUTH_CLIENT_ID'),
      password: this.configService.getOrThrow('OAUTH_CLIENT_SECRET'),
    };
  }
}

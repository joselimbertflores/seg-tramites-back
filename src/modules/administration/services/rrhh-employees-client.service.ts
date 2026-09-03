import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';

import { EnvVars } from 'src/config';

export interface RrhhActiveEmployee {
  relationKey: string;
  ci: number | string;
  ext: string | null;
  fullName: string;
  nombre: string;
  paterno: string | null;
  materno: string | null;
  casada: string | null;
  position: string | null;
  unit: string | null;
  area: string | null;
}

@Injectable()
export class RrhhEmployeesClientService {
  private readonly requestTimeoutMs = 10_000;

  constructor(private readonly configService: ConfigService<EnvVars>) {}

  async findActiveEmployeeByRelationKey(relationKey: string): Promise<RrhhActiveEmployee> {
    const requestedRelationKey = relationKey.trim();
    const url = this.buildUrl(`/internal/employees/${encodeURIComponent(requestedRelationKey)}`);
    console.log(url.toString());
    try {
      const response = await axios.get<RrhhActiveEmployee>(url.toString(), {
        headers: {
          'x-access-code': this.configService.getOrThrow('RRHH_ACCESS_TOKEN'),
        },
        timeout: this.requestTimeoutMs,
      });
      console.log(response);
      const employee = this.validateEmployee(response.data);

      if (employee.relationKey !== requestedRelationKey) {
        throw new BadGatewayException('RRHH devolvió un funcionario distinto al solicitado');
      }

      return employee;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) throw error;

      if (isAxiosError(error)) {
        if (error.response?.status === 400) {
          throw new BadRequestException('RRHH rechazó el relationKey del usuario institucional');
        }
        if (error.response?.status === 404) {
          throw new NotFoundException('RRHH no encontró un funcionario laboralmente vigente para esta identidad');
        }
        if (error.response?.status === 409) {
          throw new ConflictException('RRHH no pudo identificar inequívocamente al funcionario');
        }
      }

      throw new ServiceUnavailableException('La validación laboral en RRHH no está disponible temporalmente');
    }
  }

  private validateEmployee(employee: RrhhActiveEmployee): RrhhActiveEmployee {
    const hasValidCi =
      (typeof employee?.ci === 'number' && Number.isFinite(employee.ci) && employee.ci > 0) ||
      (typeof employee?.ci === 'string' && employee.ci.trim().length > 0);
    const optionalStringsAreValid = [
      employee?.ext,
      employee?.paterno,
      employee?.materno,
      employee?.casada,
      employee?.position,
      employee?.unit,
      employee?.area,
    ].every((value) => value === null || typeof value === 'string');

    if (
      typeof employee?.relationKey !== 'string' ||
      employee.relationKey.trim().length === 0 ||
      !hasValidCi ||
      typeof employee.fullName !== 'string' ||
      employee.fullName.trim().length === 0 ||
      typeof employee.nombre !== 'string' ||
      employee.nombre.trim().length === 0 ||
      !optionalStringsAreValid
    ) {
      throw new BadGatewayException('RRHH devolvió un funcionario inválido');
    }

    return employee;
  }

  private buildUrl(path: string): URL {
    const baseUrl = this.configService.getOrThrow('RRHH_INTERNAL_URL');
    return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  }
}

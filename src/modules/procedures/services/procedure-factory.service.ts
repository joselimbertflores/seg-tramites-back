import { BadRequestException, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { procedureGroup } from '../schemas';
import { ProcedureService } from '../domain';

import { ExternalService } from './external.service';
import { InternalService } from './internal.service';
import { ProcurementService } from './procurement.service';

@Injectable({ scope: Scope.REQUEST })
export class ProcedureFactoryService {
  constructor(
    @Inject(REQUEST) private request: Request,
    private externalService: ExternalService,
    private internalService: InternalService,
    private procurementService: ProcurementService,
  ) {}

  getService(): ProcedureService {
    const group = this.request.params['group'] as procedureGroup;
    switch (group) {
      case procedureGroup.EXTERNAL:
        return this.externalService;
      case procedureGroup.INTERNAL:
        return this.internalService;
      case procedureGroup.PROCUREMENT:
        return this.procurementService;
      default:
        throw new BadRequestException(`Procedure type: ${group} is not defined`);
    }
  }
}

import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { procedureGroup } from '../schemas';

import { ExternalService } from './external.service';
import { InternalService } from './internal.service';
import { ProcurementService } from './procurement.service';

import { validProcedureService } from '../domain';

@Injectable()
export class ProcedureFactoryService {
  constructor(
    private externalService: ExternalService,
    private internalService: InternalService,
    private procurementService: ProcurementService,
  ) {}

  // * Alternative with moduleRef
  // get(code: string) {
  //   switch (code) {
  //     case 'EMPTY':
  //       return this.moduleRef.get(EmptyReportService);
  //     case 'HALF':
  //       return this.moduleRef.get(HalfReportService);
  //     case 'FULL':
  //       return this.moduleRef.get(FullReportService);
  //   }
  // }

  getService(group: procedureGroup): validProcedureService {
    switch (group) {
      case procedureGroup.EXTERNAL:
        return this.externalService;
      case procedureGroup.INTERNAL:
        return this.internalService;
      case procedureGroup.PROCUREMENT:
        return this.procurementService;
      default:
        throw new InternalServerErrorException(`Group ${group} is not defined`);
    }
  }
}

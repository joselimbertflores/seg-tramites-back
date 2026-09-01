import { Controller, Get, Param } from '@nestjs/common';
import { IsMongoidPipe } from 'src/modules/common';

import { OnlyAssignedAccount } from 'src/modules/administration/decorators';
import { ProcedureFactoryService } from 'src/modules/procedures/services';
import { SystemResource } from 'src/modules/auth/constants';
import { RequirePermission } from 'src/modules/auth/decorators';
import { InboxService } from '../services';
import { ProcessParamDto } from '../dtos';

@OnlyAssignedAccount()
@RequirePermission([SystemResource.EXTERNAL, SystemResource.INTERNAL, SystemResource.PROCUREMENT])
@Controller('process')
export class ProcessController {
  constructor(private inboxService: InboxService, private procedureFactoryService: ProcedureFactoryService) {}

  @Get('detail/:group/:id')
  getProcedure(@Param() params: ProcessParamDto) {
    const service = this.procedureFactoryService.getService(params.group);
    return service.getDetail(params.id);
  }

  @Get('workflow/:id')
  getWorkflow(@Param('id', IsMongoidPipe) procedureId: string) {
    return this.inboxService.getWorkflow(procedureId);
  }
}

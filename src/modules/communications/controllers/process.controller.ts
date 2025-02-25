import { Controller, Get, Inject, Param } from '@nestjs/common';
import { IsMongoidPipe } from 'src/modules/common';
import { onlyAssignedAccount } from 'src/modules/administration/decorators/only-assigned-account.decorator';
import { PROCEDURE_FACTORY_TOKEN, ProcedureService } from 'src/modules/procedures/domain';
import { InboxService } from '../services';

@onlyAssignedAccount()
@Controller('process')
export class ProcessController {
  constructor(
    private inboxService: InboxService,
    @Inject(PROCEDURE_FACTORY_TOKEN) private readonly procedureService: ProcedureService,
  ) {}

  @Get('workflow/:procedureId')
  getWorkflow(@Param('procedureId', IsMongoidPipe) procedureId: string) {
    return this.inboxService.getWorkflow(procedureId);
  }

  @Get('detail/:group/:procedureId')
  getProcedure(@Param('procedureId') procedureId: string) {
    return this.procedureService.getDetail(procedureId);
  }
}

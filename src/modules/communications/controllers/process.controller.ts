import { Controller, Get, Inject, Param } from '@nestjs/common';
import { IsMongoidPipe } from 'src/modules/common';
import { onlyAssignedAccount } from 'src/modules/administration/decorators/only-assigned-account.decorator';
import { InboxService } from '../services';
import { PROCEDURE_FACTORY_TOKEN, validProcedureService } from 'src/modules/procedures/domain';
import { ProcedureFactoryService } from 'src/modules/procedures/services';

@onlyAssignedAccount()
@Controller('process')
export class ProcessController {
  constructor(
    private inboxService: InboxService,
    private procedureFactoryService: ProcedureFactoryService, 
    @Inject(PROCEDURE_FACTORY_TOKEN) private readonly procedureService: validProcedureService,
  ) {}

  @Get('detail/:group/:procedureId')
  getProcedure(@Param('procedureId') procedureId: string) {
    return this.procedureService.getDetail(procedureId);
  }

  @Get('/:group/:procedureId')
  getWorkflow(@Param('procedureId', IsMongoidPipe) procedureId: string) {
    console.log(procedureId);
    return this.inboxService.getWorkflow(procedureId);
  }
}

import { Controller, Get, Inject, Param } from '@nestjs/common';
import { IsMongoidPipe } from 'src/modules/common';
import { onlyAssignedAccount } from 'src/modules/procedures/decorators/only-assigned-account.decorator';
import { CommunicationService } from '../services';
import { PROCEDURE_FACTORY_TOKEN, ProcedureService } from 'src/modules/procedures/domain';

@onlyAssignedAccount()
@Controller('process')
export class ProcessController {
  constructor(
    private communicationService: CommunicationService,
    @Inject(PROCEDURE_FACTORY_TOKEN) private readonly procedureService: ProcedureService,
  ) {}

  @Get('workflow/:procedureId')
  getWorkflow(@Param('procedureId', IsMongoidPipe) procedureId: string) {
    return this.communicationService.getWorkflow(procedureId);
  }

  @Get('detail/:group/:procedureId')
  getProcedure(@Param('procedureId') procedureId: string) {
    return this.procedureService.getDetail(procedureId);
  }
}

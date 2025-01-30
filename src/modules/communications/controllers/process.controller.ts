import { Controller, Get, Param } from '@nestjs/common';
import { IsMongoidPipe } from 'src/modules/common';
import { onlyAssignedAccount } from 'src/modules/procedures/decorators/only-assigned-account.decorator';
import { CommunicationService } from '../services';
import { ProcedureService } from 'src/modules/procedures/services/procedure.service';

@onlyAssignedAccount()
@Controller('process')
export class ProcessController {
  constructor(private communicationService: CommunicationService, private procedureService: ProcedureService) {}

  @Get('workflow/:procedureId')
  getWorkflow(@Param('procedureId', IsMongoidPipe) procedureId: string) {
    return this.communicationService.getWorkflow(procedureId);
  }

  @Get('detail/:procedureId')
  getProcedure(@Param('procedureId', IsMongoidPipe) procedureId: string) {
    return this.procedureService.getProcedure(procedureId);
  }
}

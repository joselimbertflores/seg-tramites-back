import { Controller, Get, Param, Query } from '@nestjs/common';
import { DependencieService, InstitutionService, TypeProcedureService } from 'src/modules/administration/services';
import { IsMongoidPipe } from 'src/modules/common';

@Controller('report-commom')
export class ReportCommomController {
  constructor(
    private typeProcedureService: TypeProcedureService,
    private institutionService: InstitutionService,
    private dependencyService: DependencieService,
  ) {}

  @Get('types-procedures')
  getTypeProceduresByText(@Query('term') term: string) {
    return this.typeProcedureService.getTypesByText(term);
  }

  @Get('institutions')
  getInstitutions() {
    return this.institutionService.getActiveInstitutions();
  }

  @Get('dependencies/:institutionId')
  async getDependencies(@Param('institutionId', IsMongoidPipe) institutionId: string) {
    return await this.dependencyService.getActiveDependenciesOfInstitution(institutionId);
  }
}

import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SearchProcedureByApplicantDto, SearchProcedureDto } from './dtos';
import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { DependencieService, InstitutionService, TypeProcedureService } from 'src/modules/administration/services';

import { IsMongoidPipe } from 'src/modules/common';
import { Account } from 'src/modules/administration/schemas';
import { GetAccountRequest } from 'src/modules/administration/decorators/get-account-request.decorator';
import { RequirePermissions } from '../auth/decorators';
import { SystemResource } from '../auth/constants';
import { reportType } from './report-types.enum';

@Controller('reports')
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
    private typeProcedureService: TypeProcedureService,
    private institutionService: InstitutionService,
    private dependencyService: DependencieService,
  ) { }

  @Get('types-procedures/:term')
  getTypeProceduresByText(@Param('term') term: string, @Query('type') type: string | undefined) {
    return this.typeProcedureService.getTypesByText(term, type, true);
  }

  @Get('institutions')
  getInstitutions() {
    return this.institutionService.getActiveInstitutions();
  }

  @Get('dependencies/:id_institution')
  async getDependencies(@Param('id_institution', IsMongoidPipe) id_institution: string) {
    return await this.dependencyService.getActiveDependenciesOfInstitution(id_institution);
  }

  @RequirePermissions(SystemResource.REPORTS, [reportType.SEARCH])
  @Post('procedure')
  searchProcedureByProperties(
    @Body() body: SearchProcedureDto,
    @Query() queryParams: PaginationDto,
  ) {
    return this.reportsService.searchProcedureByProperties(queryParams, body);
  }

  @RequirePermissions(SystemResource.REPORTS, [reportType.APPLICANT])
  @Post('applicant')
  searchProcedureByApplicant(
    @Body() body: SearchProcedureByApplicantDto,
    @Query() queryParams: PaginationDto,
  ) {
    return this.reportsService.searchProcedureByApplicant(body, queryParams);
  }



  @Get('unlink')
  getAccountInbox(@GetAccountRequest() account: Account) {
    return this.reportsService.getUnlinkData(account);
  }

  @Get('communication/total/:id_account')
  getTotalCommunications(@Param('id_account') id: string) {
    return this.reportsService.getTotalCommunications(id);
  }

  @Get('unit/pendings/:dependencyId')
  getPendingsByUnit(@Param('dependencyId') dependencyId: string) {
    return this.reportsService.getPendingsByUnit(dependencyId);
  }

  @Get('pending/:id_account')
  getPendingsByAccount(@Param('id_account') id: string) {
    return this.reportsService.getPendingsByAccount(id);
  }

  @Get('inbox/:accountId')
  getInbox(@Param('accountId') id: string) {
    return this.reportsService.getImboxByAccount(id);
  }
}

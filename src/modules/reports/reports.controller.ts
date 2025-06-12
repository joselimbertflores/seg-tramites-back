import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  GetTotalCommunicationsByUnit,
  GetTotalProceduresByStateDto,
  SearchProcedureByApplicantDto,
  SearchProcedureDto,
} from './dtos';
import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { DependencieService, InstitutionService, TypeProcedureService } from 'src/modules/administration/services';

import { IsMongoidPipe } from 'src/modules/common';
import { Account } from 'src/modules/administration/schemas';
import { GetAccountRequest } from 'src/modules/administration/decorators/get-account-request.decorator';
import { GetUserRequest, RequirePermissions } from '../auth/decorators';
import { SystemResource } from '../auth/constants';
import { reportType } from './report-types.enum';
import { onlyAssignedAccount } from '../administration/decorators';

@onlyAssignedAccount()
@Controller('reports')
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
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

  @Get('dependencies/:id_institution')
  async getDependencies(@Param('id_institution', IsMongoidPipe) id_institution: string) {
    return await this.dependencyService.getActiveDependenciesOfInstitution(id_institution);
  }

  @RequirePermissions(SystemResource.REPORTS, [reportType.SEARCH])
  @Post('procedure')
  searchProcedureByProperties(@Body() body: SearchProcedureDto, @Query() queryParams: PaginationDto) {
    return this.reportsService.searchProcedureByProperties(queryParams, body);
  }

  @RequirePermissions(SystemResource.REPORTS, [reportType.APPLICANT])
  @Post('applicant')
  searchProcedureByApplicant(@Body() body: SearchProcedureByApplicantDto, @Query() queryParams: PaginationDto) {
    return this.reportsService.searchProcedureByApplicant(body, queryParams);
  }

  @HttpCode(HttpStatus.OK)
  @RequirePermissions(SystemResource.REPORTS, [reportType.UNIT])
  @Post('unit')
  getTotalCommunicationsByUnit(@Body() body: GetTotalCommunicationsByUnit, @GetAccountRequest() account: Account) {
    return this.reportsService.getTotalCommunicationsByUnit(body, account.dependencia.id);
  }

  @HttpCode(HttpStatus.OK)
  // @RequirePermissions(SystemResource.REPORTS, [reportType.UNIT])
  @Post('procedures/state')
  getTotalProceduresByState(@Body() body: GetTotalProceduresByStateDto) {
    return this.reportsService.getTotalProceduresByState(body);
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

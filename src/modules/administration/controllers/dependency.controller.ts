import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';

import { InstitutionService, DependencieService } from '../services';
import { UpdateDependencyDto, CreateDependencyDto, AssignDependencyAreasDto } from '../dtos';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { PaginationDto } from 'src/modules/common';

@Controller('dependencies')
@ResourceProtected(SystemResource.DEPENDENCIES)
export class DependencyController {
  constructor(
    private readonly dependencyService: DependencieService,
    private readonly institutionService: InstitutionService,
  ) {}

  @Get('institutions')
  getInstitutions() {
    return this.institutionService.getActiveInstitutions();
  }

  @Get(':id/accounts')
  getAccountsInDependency(@Param('id') id: string) {
    return this.dependencyService.getAccountsInDependency(id);
  }

  @Put('areas')
  assinAreas(@Body() data: AssignDependencyAreasDto) {
    return this.dependencyService.assignAreas(data);
  }

  @Get()
  findAll(@Query() params: PaginationDto) {
    return this.dependencyService.findAll(params);
  }

  @Patch('/:id')
  update(@Param('id') id: string, @Body() dependency: UpdateDependencyDto) {
    return this.dependencyService.update(id, dependency);
  }

  @Post()
  create(@Body() dependency: CreateDependencyDto) {
    return this.dependencyService.create(dependency);
  }
}

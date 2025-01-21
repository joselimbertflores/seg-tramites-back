import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { InstitutionService, DependencieService } from '../services';
import { UpdateDependencyDto, CreateDependencyDto } from '../dtos';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { PaginationDto } from 'src/common';

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

  @Get()
  findAll(@Query() params: PaginationDto) {
    return this.dependencyService.findAll(params);
  }

  @Patch('/:id')
  edit(@Param('id') id: string, @Body() dependency: UpdateDependencyDto) {
    return this.dependencyService.update(id, dependency);
  }

  @Post()
  add(@Body() dependency: CreateDependencyDto) {
    return this.dependencyService.create(dependency);
  }
}

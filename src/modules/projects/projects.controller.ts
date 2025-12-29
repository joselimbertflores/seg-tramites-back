import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { GetAccountRequest, onlyAssignedAccount } from '../administration/decorators';
import { CreateProjectDio, UpdateProjectDto } from './dots/project.dto';
import { IsMongoidPipe, PaginationDto } from '../common';
import { ProjectsService } from './projects.service';
import { Account } from '../administration/schemas';

@onlyAssignedAccount()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@GetAccountRequest('_id') accountId: string, @Query() paginationDto: PaginationDto) {
    return this.projectsService.findAll(paginationDto, accountId);
  }

  @Post()
  create(@GetAccountRequest() account: Account, @Body() procedureDto: CreateProjectDio) {
    return this.projectsService.create(procedureDto, account);
  }

  @Patch(':id')
  update(@Param('id', IsMongoidPipe) procedureId: string, @Body() procedureDto: UpdateProjectDto) {
    return this.projectsService.update(procedureId, procedureDto);
  }

  @Get('detail/:id')
  getDetail(@Param('id', IsMongoidPipe) procedureId: string) {
    return this.projectsService.getDetail(procedureId);
  }

  @Post(':id/requirement/:index/confirm')
  confirm(@Param() params: { id: string; index: string }, @GetAccountRequest() account: Account) {
    return this.projectsService.confirmRequirement(params.id, +params.index, account);
  }

  @Get('search')
  search(@Query() params: { term: string }) {
    return this.projectsService.searchProjects(params.term);
  }
}

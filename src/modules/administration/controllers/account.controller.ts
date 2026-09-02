import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';

import { AccountService, DependencieService, InstitutionService } from 'src/modules/administration/services';
import { AssignAccountDto, CreateAccountDto, FilterAccountDto, UpdateAccountDto } from '../dtos';
import { GetUserRequest, RequirePermission } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { IsMongoidPipe } from 'src/modules/common';
import { RoleService } from '../../users/services';

@Controller('accounts')
@RequirePermission(SystemResource.ACCOUNTS)
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly institutionService: InstitutionService,
    private readonly dependencieService: DependencieService,
    private readonly roleService: RoleService,
  ) {}

  @Get()
  findAll(@Query() params: FilterAccountDto) {
    return this.accountService.findAll(params);
  }

  @Post()
  create(@Body() accountDto: CreateAccountDto) {
    return this.accountService.create(accountDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateAccountDto) {
    return this.accountService.update(id, body);
  }

  @Put(':id/assignment')
  assign(@Param('id', IsMongoidPipe) id: string, @Body() assignment: AssignAccountDto) {
    return this.accountService.update(id, assignment);
  }

  @Patch(':id/unassign')
  unassign(@Param('id', IsMongoidPipe) id: string) {
    return this.accountService.update(id, { assigneeExternalKey: null });
  }

  @Get('institutions')
  getInstitutions() {
    return this.institutionService.getActiveInstitutions();
  }

  @Get('dependencies/:institutionId')
  getDependencies(@Param('institutionId', IsMongoidPipe) institutionId: string) {
    return this.dependencieService.getActiveDependenciesOfInstitution(institutionId);
  }

  @Get('assign/users')
  searchIdentityCandidates(@Query('term') text: string) {
    return this.accountService.searchIdentityCandidates(text);
  }

  @Get('roles')
  getRoles() {
    return this.roleService.getAll();
  }

  @Patch('reset-password/:accountId')
  resetCrendtials(@Param('accountId') accountId: string, @GetUserRequest('fullname') fullName: string) {
    return this.accountService.resetAccountPassword(accountId, fullName);
  }
}

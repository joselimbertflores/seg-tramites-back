import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  AccountService,
  DependencieService,
  InstitutionService,
  OfficerService,
} from 'src/modules/administration/services';
import { CreateAccountWithUserDto, FilterAccountDto, UpdateAccountWithUserDto } from '../dtos';
import { GetUserRequest, ResourceProtected } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { IsMongoidPipe } from 'src/modules/common';
import { RoleService } from '../../users/services';

@Controller('accounts')
@ResourceProtected(SystemResource.ACCOUNTS)
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly institutionService: InstitutionService,
    private readonly dependencieService: DependencieService,
    private readonly officerService: OfficerService,
    private readonly roleService: RoleService,
  ) {}

  @Get()
  findAll(@Query() params: FilterAccountDto) {
    return this.accountService.findAll(params);
  }

  @Post()
  create(@Body() accountDto: CreateAccountWithUserDto, @GetUserRequest('fullname') fullName: string) {
    return this.accountService.create(accountDto, fullName);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateAccountWithUserDto,
    @GetUserRequest('fullname') fullName: string,
  ) {
    return this.accountService.update(id, body, fullName);
  }

  @Get('institutions')
  getInstitutions() {
    return this.institutionService.getActiveInstitutions();
  }

  @Get('dependencies/:institutionId')
  getDependencies(@Param('institutionId', IsMongoidPipe) institutionId: string) {
    return this.dependencieService.getActiveDependenciesOfInstitution(institutionId);
  }

  @Get('assign')
  searchOfficersWithoutAccount(@Query('term') text: string) {
    return this.officerService.searchOfficersWithoutAccount(text);
  }

  @Get('roles')
  getRoles() {
    return this.roleService.getActiveRoles();
  }

  @Patch('reset-password/:accountId')
  resetCrendtials(@Param('accountId') accountId: string, @GetUserRequest('fullname') fullName: string) {
    return this.accountService.resetAccountPassword(accountId, fullName);
  }
}

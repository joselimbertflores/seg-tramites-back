import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';

import { GetAccountRequest, OnlyAssignedAccount } from 'src/modules/administration/decorators';
import { Account } from 'src/modules/administration/schemas';
import { SystemResource } from 'src/modules/auth/constants';
import { RequirePermission } from 'src/modules/auth/decorators';
import { CreateArchiveDto, FilterArchiveDto } from '../dtos';
import { ArchiveService } from '../services';

@OnlyAssignedAccount()
@RequirePermission([SystemResource.EXTERNAL, SystemResource.INTERNAL, SystemResource.PROCUREMENT])
@Controller('archives')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get()
  findAll(@Query() queryParams: FilterArchiveDto, @GetAccountRequest() account: Account) {
    return this.archiveService.findAll(queryParams, account);
  }

  @Post()
  archive(@Body() archiveDto: CreateArchiveDto, @GetAccountRequest() account: Account) {
    return this.archiveService.create(account, archiveDto);
  }

  @Delete(':id')
  unarchive(@Param('id') id: string, @GetAccountRequest() account: Account) {
    return this.archiveService.remove(id, account);
  }

  @Get('dependency')
  getAccountByDependency(@GetAccountRequest() account: Account) {
    return this.archiveService.getAccountByDependency(account.dependencia.id);
  }
}

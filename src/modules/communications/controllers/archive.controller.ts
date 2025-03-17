import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { GroupwareGateway } from 'src/modules/groupware/groupware.gateway';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { ArchiveService } from '../services/archive.service';

import { Account } from 'src/modules/administration/schemas';
import { SystemResource } from 'src/modules/auth/constants';
import { CreateArchiveDto, FilterArchiveDto, SelectedArchivesDto } from '../dtos';
import { GetAccountRequest, onlyAssignedAccount } from 'src/modules/administration/decorators';

@ResourceProtected(SystemResource.archived)
@onlyAssignedAccount()
@Controller('archives')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService, private readonly groupwareGateway: GroupwareGateway) {}

  @Get()
  findAll(@Query() queryParams: FilterArchiveDto, @GetAccountRequest() account: Account) {
    return this.archiveService.findAll(queryParams, account);
  }

  @Post()
  archive(@Body() archiveDto: CreateArchiveDto, @GetAccountRequest() account: Account) {
    return this.archiveService.create(account, archiveDto);
  }

  @Post('unarchive')
  unarchive(@Body() data: SelectedArchivesDto, @GetAccountRequest() account: Account) {
    return this.archiveService.unarchive(data, account);
  }
}

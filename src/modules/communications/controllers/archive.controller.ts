import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { GroupwareGateway } from 'src/modules/groupware/groupware.gateway';
import { ArchiveService } from '../services/archive.service';

import { Account } from 'src/modules/administration/schemas';
import { CreateArchiveDto, FilterArchiveDto } from '../dtos';
import { GetAccountRequest, onlyAssignedAccount } from 'src/modules/administration/decorators';

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

  @Delete(':id')
  unarchive(@Param('id') id: string, @GetAccountRequest() account: Account) {
    return this.archiveService.remove(id, account);
  }
}

import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import type { Account } from 'src/modules/administration/schemas';

import { onlyAssignedAccount, GetAccountRequest } from 'src/modules/administration/decorators';
import { MultiResourceProtected } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';
import { FolderService } from '../services';
import { CreateFolderDto } from '../dtos';

@onlyAssignedAccount()
@MultiResourceProtected({ resources: [SystemResource.EXTERNAL, SystemResource.INTERNAL, SystemResource.PROCUREMENT] })
@Controller('folders')
export class FolderController {
  constructor(private folderService: FolderService) {}

  @Post()
  create(@Body() folderDto: CreateFolderDto, @GetAccountRequest() account: Account) {
    return this.folderService.create(folderDto, account);
  }

  @Get()
  findAll(@GetAccountRequest() account: Account) {
    return this.folderService.findAll(account);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.folderService.delete(id);
  }
}

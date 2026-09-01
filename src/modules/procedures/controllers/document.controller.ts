import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { GetAccountRequest, OnlyAssignedAccount } from 'src/modules/administration/decorators';
import { AccountService } from 'src/modules/administration/services';
import { Account } from 'src/modules/administration/schemas';
import { IsMongoidPipe } from 'src/modules/common';
import { SystemResource } from 'src/modules/auth/constants';
import { RequirePermission } from 'src/modules/auth/decorators';

import { DocumentService } from '../services';
import { CreateDocDto, FilterDocsDto, UpdateDocDto } from '../../communications/dtos';

@Controller('documents')
@OnlyAssignedAccount()
@RequirePermission([SystemResource.EXTERNAL, SystemResource.INTERNAL, SystemResource.PROCUREMENT])
export class DocumentController {
  constructor(private documentService: DocumentService, private accountService: AccountService) {}

  @Post()
  create(@Body() body: CreateDocDto, @GetAccountRequest() account: Account) {
    return this.documentService.create(account, body);
  }

  @Patch(':id')
  update(@Param('id', IsMongoidPipe) id: string, @Body() body: UpdateDocDto) {
    return this.documentService.update(id, body);
  }

  @Get()
  findAll(@GetAccountRequest() account: Account, @Query() filterDto: FilterDocsDto) {
    return this.documentService.findAll(account, filterDto);
  }

  @Get('accounts')
  searchAccounts(@Query('term') term: string) {
    return this.accountService.searchActiveAccounts(term);
  }

  @Get('pending')
  searchPendingDocs(@Query('term') term: string, @GetAccountRequest() account: Account) {
    return this.documentService.searchPendingDocs(account, term);
  }
}

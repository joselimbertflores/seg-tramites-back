import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { onlyAssignedAccount } from 'src/modules/administration/decorators/only-assigned-account.decorator';
import { GetAccountRequest } from 'src/modules/administration/decorators/get-account-request.decorator';
import { AccountService } from 'src/modules/administration/services';
import { Account } from 'src/modules/administration/schemas';
import { IsMongoidPipe } from 'src/modules/common';

import { DocumentService } from '../services';
import { CreateDocDto, FilterDocsDto, UpdateDocDto } from '../../communications/dtos';

@Controller('documents')
@onlyAssignedAccount()
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

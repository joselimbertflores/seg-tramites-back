import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { onlyAssignedAccount } from 'src/modules/procedures/decorators/only-assigned-account.decorator';
import { GetAccountRequest } from 'src/modules/procedures/decorators/get-account-request.decorator';
import { AccountService } from 'src/modules/administration/services';
import { Account } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/common';

import { DocumentService } from '../services/document.service';
import { CreateDocDto, UpdateDocDto } from '../dtos';

@Controller('documents')
@onlyAssignedAccount()
export class DocumentController {
  constructor(private documentService: DocumentService, private accountService: AccountService) {}

  @Post()
  create(@Body() body: CreateDocDto, @GetAccountRequest() account: Account) {
    return this.documentService.create(account, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateDocDto) {
    return this.documentService.update(id, body);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto, @GetAccountRequest() account: Account) {
    return this.documentService.findAll(account, paginationDto);
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

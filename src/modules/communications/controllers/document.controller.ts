import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { onlyAssignedAccount } from 'src/modules/procedures/decorators/only-assigned-account.decorator';
import { GetAccountRequest } from 'src/modules/procedures/decorators/get-account-request.decorator';
import { DocumentService } from '../services/document.service';
import { Account } from 'src/modules/administration/schemas';
import { PaginationDto } from 'src/common';
import { CreateDocDto } from '../dtos';

@Controller('documents')
@onlyAssignedAccount()
export class DocumentController {
  constructor(private documentService: DocumentService) {}

  @Post()
  create(@Body() body: CreateDocDto, @GetAccountRequest() account: Account) {
    return this.documentService.create(account, body);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto, @GetAccountRequest() account: Account) {
    return this.documentService.findAll(account, paginationDto);
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GroupwareGateway } from 'src/modules/groupware/groupware.gateway';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { ArchiveService } from '../services/archive.service';

import { Account } from 'src/modules/administration/schemas';
import { SystemResource } from 'src/modules/auth/constants';
import { onlyAssignedAccount } from '../../procedures/decorators/only-assigned-account.decorator';
import { GetAccountRequest } from '../../procedures/decorators/get-account-request.decorator';
import { CreateArchiveDto, FilterArchiveDto } from '../dtos';

@ResourceProtected(SystemResource.archived)
@onlyAssignedAccount()
@Controller('archives')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService, private readonly groupwareGateway: GroupwareGateway) {}

  @Post()
  create(@Body() archiveDto: CreateArchiveDto, @GetAccountRequest() account: Account) {
    return this.archiveService.create(account, archiveDto);
  }

  @Get()
  findAll(@Query() queryParams: FilterArchiveDto, @GetAccountRequest() account: Account) {
    return this.archiveService.findAll(queryParams, account);
  }

  @Post('mail/restore/:id_mail')
  async unarchiveMail(@Param('id_mail') id_mail: string, @GetAccountRequest() account: Account) {
    const message = await this.archiveService.unarchiveMail(id_mail, account);
    this.groupwareGateway.notifyUnarchive(String(account.dependencia._id), id_mail);
    return { message };
  }
}

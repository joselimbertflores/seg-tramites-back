import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ArchiveService } from '../services/archive.service';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { GroupwareGateway } from 'src/modules/groupware/groupware.gateway';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

import { SystemResource } from 'src/modules/auth/constants';
import { CreateArchiveDto } from '../../procedures/dto';
import { IsMongoidPipe } from 'src/common';
import { Account } from 'src/modules/administration/schemas';
import { onlyAssignedAccount } from '../../procedures/decorators/only-assigned-account.decorator';
import { GetAccountRequest } from '../../procedures/decorators/get-account-request.decorator';

@ResourceProtected(SystemResource.archived)
@onlyAssignedAccount()
@Controller('archives')
export class ArchiveController {
  constructor(
    private readonly archiveService: ArchiveService,
    private readonly groupwareGateway: GroupwareGateway,
  ) {}

  @Post('mail/:id')
  create(
    @Param('id', IsMongoidPipe) id: string,
    @Body() data: CreateArchiveDto,
    @GetAccountRequest() account: Account,
  ) {
    return this.archiveService.create(id, account, data);
  }

  @Post('mail/restore/:id_mail')
  async unarchiveMail(
    @Param('id_mail') id_mail: string,
    @GetAccountRequest() account: Account,
  ) {
    const message = await this.archiveService.unarchiveMail(id_mail, account);
    this.groupwareGateway.notifyUnarchive(
      String(account.dependencia._id),
      id_mail,
    );
    return { message };
  }

  @Get()
  findAll(
    @Query() paginationParams: PaginationDto,
    @GetAccountRequest() account: Account,
  ) {
    return this.archiveService.findAll(paginationParams, account);
  }

  @Get('search/:text')
  searc(
    @Query() paginationParams: PaginationDto,
    @GetAccountRequest() account: Account,
    @Param('text') text: string,
  ) {
    return this.archiveService.search(
      paginationParams,
      text,
      account.dependencia._id,
    );
  }
}

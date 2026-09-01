import { Controller, Get } from '@nestjs/common';
import { GetAccountRequest, OnlyAssignedAccount } from 'src/modules/administration/decorators';
import { Account } from '../schemas';

@Controller('assignation')
@OnlyAssignedAccount()
export class AssigationController {
  // * Get current active account
  @Get()
  checkAccount(@GetAccountRequest() acount: Account) {
    return acount;
  }
}

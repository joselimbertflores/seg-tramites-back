import { Controller, Get } from '@nestjs/common';
import { GetAccountRequest, onlyAssignedAccount } from 'src/modules/administration/decorators';
import { Account } from '../schemas';

@Controller('assignation')
@onlyAssignedAccount()
export class AssigationController {
  // * Get current active account
  @Get()
  checkAccount(@GetAccountRequest() acount: Account) {
    return acount;
  }
}

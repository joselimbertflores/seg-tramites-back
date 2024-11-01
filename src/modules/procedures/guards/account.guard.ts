import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User } from 'src/modules/users/schemas';
import { Account } from 'src/modules/administration/schemas';

@Injectable()
export class AccountGuard implements CanActivate {
  constructor(@InjectModel(Account.name) private accountModel: Model<Account>) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user: User = request['user'];
    if (!user) {
      throw new InternalServerErrorException('User is not authenticated');
    }
    const account = await this.accountModel.findOne({ user: user._id }).populate(['officer', 'dependencia']);

    if (!account) {
      throw new ForbiddenException(`No esta vinculado a ninguna cuenta`);
    }
    if (!account.officer) {
      throw new BadRequestException(`La cuenta no esta asignada`);
    }
    request['account'] = account;
    return true;
  }
}

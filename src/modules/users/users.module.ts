import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema, User, UserSchema } from './schemas';
import { RoleController, UserController } from './controllers';
import { IdentityHubUsersClientService, RoleService, UserService } from './services';

@Module({
  controllers: [RoleController, UserController],
  providers: [RoleService, UserService, IdentityHubUsersClientService],
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  exports: [MongooseModule, UserService, RoleService, IdentityHubUsersClientService],
})
export class UsersModule {}

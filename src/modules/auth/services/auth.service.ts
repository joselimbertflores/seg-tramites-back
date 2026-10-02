import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { LocalLoginDto, ChangePasswordDto } from '../dto';

import { User } from 'src/modules/users/schemas';
import { FRONTEND_MENU } from '../constants';
import { AuthorizationContextService, EffectivePermissions } from './authorization-context.service';
import { AuthSessionService } from './auth-session.service';
import { AuthMethod } from '../schemas/auth-session.schema';

@Injectable()
export class AuthService {
  constructor(
    private sessions: AuthSessionService,
    @InjectModel(User.name) private userModel: Model<User>,
    private authorizationContext: AuthorizationContextService,
  ) {}

  async login({ login, password }: LocalLoginDto) {
    const user = await this.userModel.findOne({ login }).populate('roles');
    if (!user) {
      throw new BadRequestException('Usuario o Contraseña incorrectos');
    }
    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      throw new BadRequestException('Usuario o Contraseña incorrectos');
    }
    if (!user.isActive) {
      throw new BadRequestException('La cuenta ha sido deshabilitada');
    }
    return { user, session: await this.sessions.create(user, 'LOCAL') };
  }

  async checkAuthStatus(user: User, authMethod: AuthMethod) {
    const { account, permissions } = await this.authorizationContext.resolveUser(user);
    return {
      user: {
        userId: user._id.toString(),
        fullname: user.fullname,
        login: user.login,
        externalKey: user.externalKey,
      },
      authMethod,
      menu: this.getFrontMenu(permissions),
      permissions,
      account,
      ...(authMethod === 'LOCAL' ? { updatedPassword: user.updatedPassword } : {}),
    };
  }

  async changePassword(id: string, data: ChangePasswordDto, authMethod: AuthMethod) {
    if (authMethod !== 'LOCAL')
      throw new ForbiddenException('La contraseña de esta sesión se administra en Identity Hub');
    const user = await this.userModel.findById(id).select('login password');
    if (!user?.login || !user.password) {
      throw new BadRequestException('El usuario no tiene credenciales locales para cambiar');
    }
    const { password } = data;
    const encryptedPassword = await bcrypt.hash(password, 10);
    await this.userModel.updateOne({ _id: id }, { password: encryptedPassword, updatedPassword: true });
    return { message: 'Contraseña actualizada' };
  }

  private getFrontMenu(permissions: EffectivePermissions) {
    return structuredClone(FRONTEND_MENU).filter((menu) => {
      if (!menu.children) {
        return menu.requiredResources.some((resource) => permissions[resource]?.length);
      }
      menu.children = menu.children.filter((submenu) =>
        submenu.requiredResources.some((resource) => permissions[resource]?.length),
      );
      return menu.children.length > 0;
    });
  }
}

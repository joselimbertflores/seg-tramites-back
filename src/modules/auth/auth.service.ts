import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { AuthDto, UpdateMyUserDto } from './dto';

import { User } from 'src/modules/users/schemas';
import { FRONTEND_MENU } from './constants';
import { JwtPayload } from './interfaces';
import { AuthorizationContextService, EffectivePermissions } from './services';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<User>,
    private authorizationContext: AuthorizationContextService,
  ) {}

  async login({ login, password }: AuthDto) {
    const user = await this.userModel.findOne({ login });
    if (!user) {
      throw new BadRequestException('Usuario o Contraseña incorrectos');
    }
    if (!user.password || !bcrypt.compareSync(password, user.password)) {
      throw new BadRequestException('Usuario o Contraseña incorrectos');
    }
    if (!user.isActive) {
      throw new BadRequestException('La cuenta ha sido deshabilidata');
    }
    return { token: this.generateToken(user) };
  }

  async checkAuthStatus(user: User) {
    const { account, permissions } = await this.authorizationContext.resolveUser(user);
    return {
      token: this.generateToken(user),
      menu: this.getFrontMenu(permissions),
      permissions,
      account,
      updatedPassword: user.updatedPassword,
    };
  }

  async updateMyUser(id: string, data: UpdateMyUserDto) {
    const { password } = data;
    const salt = bcrypt.genSaltSync();
    const encryptedPassword = bcrypt.hashSync(password.toString(), salt);
    await this.userModel.updateOne({ _id: id }, { password: encryptedPassword, updatedPassword: true });
    return { message: 'Contraseña actualizada' };
  }

  private generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user._id.toString(),
      fullname: user.fullname,
    };
    return this.jwtService.sign(payload);
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

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { AuthDto, UpdateMyUserDto } from './dto';

import { User, Role } from 'src/modules/users/schemas';
import { FRONTEND_MENU } from './constants';
import { JwtPayload } from './interfaces';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, @InjectModel(User.name) private userModel: Model<User>) {}

  async login({ login, password }: AuthDto) {
    const user = await this.userModel.findOne({ login });
    if (!user) {
      throw new BadRequestException('Usuario o Contraseña incorrectos');
    }
    if (!bcrypt.compareSync(password, user.password)) {
      throw new BadRequestException('Usuario o Contraseña incorrectos');
    }
    if (!user.isActive) {
      throw new BadRequestException('La cuenta ha sido deshabilidata');
    }
    return { token: this.generateToken(user) };
  }

  async checkAuthStatus(user: User) {
    return {
      token: this.generateToken(user),
      menu: this.getFrontMenu(user.role),
      permissions: this.getPermissions(user.role),
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

  private getPermissions({ permissions }: Role) {
    return permissions.reduce((result, { actions, resource }) => ({ [resource]: actions, ...result }), {});
  }

  private getFrontMenu({ permissions }: Role) {
    return structuredClone(FRONTEND_MENU).filter((menu) => {
      if (!menu.children) {
        return permissions.some(({ resource }) => menu.requiredResources.includes(resource));
      }
      menu.children = menu.children.filter((submenu) =>
        permissions.some(({ resource }) => submenu.requiredResources.includes(resource)),
      );
      return menu.children.length > 0;
    });
  }
}

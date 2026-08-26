import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { AuthDto, UpdateMyUserDto } from './dto';

import { RoleContext, User, Role } from 'src/modules/users/schemas';
import { Account } from 'src/modules/administration/schemas';
import { FRONTEND_MENU, SystemResource } from './constants';
import { JwtPayload } from './interfaces';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
  ) {}

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
    const account = await this.accountModel
      .findOne({ user: user._id, officer: { $ne: null } })
      .populate(['role', 'officer', 'dependencia', 'institution']);
    const directRole = user.directRole?.context === RoleContext.USER ? user.directRole : null;
    const accountRole = account?.role?.context === RoleContext.ACCOUNT ? account.role : null;
    const directPermissions = this.getPermissions(directRole);
    const accountPermissions = this.getPermissions(accountRole);
    return {
      token: this.generateToken(user),
      menu: this.getFrontMenu(directRole, accountRole),
      permissions: {
        direct: directPermissions,
        account: accountPermissions,
      },
      account: account ?? null,
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

  private getPermissions(role?: Role | null) {
    const permissions = role?.permissions ?? [];
    return permissions.reduce((result, { actions, resource }) => ({ [resource]: actions, ...result }), {});
  }

  private getFrontMenu(directRole?: Role | null, accountRole?: Role | null) {
    const accountMenuResources = new Set([
      SystemResource.EXTERNAL,
      SystemResource.INTERNAL,
      SystemResource.PROCUREMENT,
      SystemResource.REPORTS,
      SystemResource.PUBLICATIONS,
    ]);
    const permissions = [
      ...(directRole?.permissions ?? []),
      ...(accountRole?.permissions.filter(({ resource }) => accountMenuResources.has(resource)) ?? []),
    ];
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

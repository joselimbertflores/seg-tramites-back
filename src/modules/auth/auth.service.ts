import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { AuthDto, UpdateMyAccountDto } from './dto';
import { EnvConfig, JwtPayload } from './interfaces';

import { logger } from 'src/config/logger';
import { User, UserDocument, Role } from 'src/modules/users/schemas';
import { FRONTEND_MENU } from './constants';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService<EnvConfig>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async login({ login, password }: AuthDto, ip: string) {
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
    logger.info(`Ingreso de usuario (${login}) ${user.fullname} / IP: ${ip}`);
    return { token: this._generateToken(user) };
  }

  async checkAuthStatus(user: UserDocument) {
    return {
      token: this._generateToken(user),
      menu: this._getFrontMenu(user.role),
      permissions: this._getPermissions(user.role),
      updatedPassword: user.updatedPassword,
    };
  }

  async getMyAuthDetails(id_account: string) {
    return await this.userModel
      .findById(id_account)
      .populate({
        path: 'funcionario',
        populate: {
          path: 'cargo',
        },
      })
      .populate({
        path: 'dependencia',
        select: 'nombre codigo',
        populate: {
          path: 'institucion',
          select: 'nombre',
        },
      })
      .select('-password -rol');
  }

  async updateMyAccount(id_account: string, data: UpdateMyAccountDto) {
    const { password } = data;
    const salt = bcrypt.genSaltSync();
    const encryptedPassword = bcrypt.hashSync(password.toString(), salt);
    await this.userModel.updateOne({ _id: id_account }, { password: encryptedPassword, updatedPassword: true });
    return { message: 'Contraseña actualizada' };
  }

  private _generateToken(user: UserDocument): string {
    const payload: JwtPayload = {
      userId: user._id.toString(),
      fullname: user.fullname,
    };
    return this.jwtService.sign(payload);
  }

  private _getPermissions({ permissions }: Role) {
    return permissions.reduce((result, { actions, resource }) => ({ [resource]: actions, ...result }), {});
  }

  private _getFrontMenu({ permissions }: Role) {
    return structuredClone(FRONTEND_MENU).filter((menu) => {
      if (!menu.children) {
        return permissions.some(({ resource }) => menu.resource.includes(resource));
      }
      menu.children = menu.children.filter((submenu) =>
        permissions.some(({ resource }) => submenu.resource.includes(resource)),
      );
      return menu.children.length > 0;
    });
  }
}

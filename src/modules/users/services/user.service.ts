import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, FilterQuery, Model, ClientSession } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { User, UserDocument } from '../schemas';
import { CreateUserDto, UpdateUserDto } from '../dtos';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  public async createWithTransaction(userDto: CreateUserDto, session: ClientSession) {
    await this.checkDuplicateLogin(userDto.login);
    const { password, ...userProps } = userDto;
    const encryptPassword = this._encryptPassword(password);
    const createdUser = new this.userModel({ ...userProps, password: encryptPassword });
    return await createdUser.save({ session });
  }

  async findAll({ limit, offset, term }: PaginationDto) {
    const query: FilterQuery<User> = {
      ...(term && { fullname: new RegExp(term, 'i') }),
    };
    const [users, length] = await Promise.all([
      this.userModel.find(query).skip(offset).limit(limit).sort({ _id: -1 }),
      this.userModel.count(query),
    ]);
    return { users: users.map((user) => this._plainUser(user)), length };
  }

  async create(userDto: CreateUserDto, session?: ClientSession) {
    const createdUser = new this.userModel(userDto);
    await this.checkDuplicateLogin(userDto.login);
    userDto.password = this._encryptPassword(userDto.password);
    await createdUser.save({ session });
    return this._plainUser(createdUser);
  }

  async update(id: string, userDto: UpdateUserDto, session?: ClientSession) {
    const userDb = await this.userModel.findById(id);
    if (!userDb) throw new NotFoundException(`El usuario ${id} no existe`);
    if (userDto.login && userDb.login !== userDto.login) {
      await this.checkDuplicateLogin(userDto.login);
    }
    if (userDto.password) {
      userDto.password = this._encryptPassword(userDto.password);
    }
    const updatedUser = await this.userModel.findByIdAndUpdate(id, userDto, {
      new: true,
      session,
    });
    return this._plainUser(updatedUser);
  }

  private async checkDuplicateLogin(login: string): Promise<void> {
    const duplicate = await this.userModel.findOne({ login });
    if (duplicate) {
      throw new BadRequestException(`El login ${login} ya existe`);
    }
  }

  private _encryptPassword(password: string): string {
    const salt = bcrypt.genSaltSync();
    return bcrypt.hashSync(password, salt);
  }

  private _plainUser(user: User): User {
    const result = user instanceof Document ? user.toObject() : user;
    delete result.password;
    return result;
  }
}

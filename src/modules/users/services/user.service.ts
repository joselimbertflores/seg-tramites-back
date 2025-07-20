import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, ClientSession, Document, UpdateQuery } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { generatePassword } from 'src/helpers';
import { CreateUserDto, UpdateUserDto } from '../dtos';
import { User } from '../schemas';

interface UpdateUserTransactionProps {
  id: string;
  user: UpdateUserDto;
  session: ClientSession;
  resetPassword?: boolean;
}

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findAll({ limit, offset, term }: PaginationDto) {
    const query: FilterQuery<User> = {
      ...(term && { fullname: new RegExp(term, 'i') }),
    };
    const [users, length] = await Promise.all([
      this.userModel.find(query).skip(offset).limit(limit).sort({ _id: -1 }),
      this.userModel.count(query),
    ]);
    return { users: users.map((user) => this.plainUser(user)), length };
  }

  async create(userDto: CreateUserDto, session?: ClientSession) {
    const password = generatePassword();
    const encryptPassword = this.encryptPassword(password);

    const createdUser = new this.userModel({
      ...userDto,
      password: encryptPassword,
    });

    try {
      await createdUser.save(session ? { session } : {});
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException(`El login ${userDto.login} ya existe`);
      }
      throw new InternalServerErrorException('Error create user');
    }
    return {
      user: this.plainUser(createdUser),
      generatedPassword: password,
    };
  }

  async update(id: string, userDto: UpdateUserDto) {
    const userDb = await this.userModel.findById(id);
    if (!userDb) throw new NotFoundException(`User ${id} not found`);

    try {
      const updatedUser = await this.userModel.findByIdAndUpdate(id, userDto, { new: true });
      return this.plainUser(updatedUser);
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException(`Login ${userDto.login} already exists`);
      }
      throw new InternalServerErrorException('Error update user');
    }
  }

  async updateWithTransaction(updateData: UpdateUserTransactionProps) {
    const { id, user, session, resetPassword = false } = updateData;
    const userDb = await this.userModel.findById(id, null, { session });
    if (!userDb) throw new NotFoundException(`User with id ${id} not found`);
    let newPassword: string | null = null;
    const updateQuery: UpdateQuery<User> = { ...user };
    if (resetPassword) {
      newPassword = generatePassword();
      updateQuery.password = this.encryptPassword(newPassword);
      updateQuery.updatedPassword = false;
    }
    try {
      const updatedUser = await this.userModel.findByIdAndUpdate(id, updateQuery, { session, new: true });
      return { user: this.plainUser(updatedUser), ...(newPassword && { generatedPassword: newPassword }) };
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException(`Login ${user.login} already exists`);
      }
      throw new InternalServerErrorException('Error update user');
    }
  }

  async resetPassword(user: User) {
    const newPassword = generatePassword();
    const encryptPassword = this.encryptPassword(newPassword);
    await this.userModel.updateOne({ _id: user._id }, { password: encryptPassword, updatedPassword: false });
    return { password: newPassword };
  }

  private encryptPassword(password: string): string {
    const salt = bcrypt.genSaltSync();
    return bcrypt.hashSync(password, salt);
  }

  private plainUser(user: User): User {
    const result = user instanceof Document ? user.toObject() : user;
    delete result.password;
    return result;
  }
}

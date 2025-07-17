import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, FilterQuery, Model, ClientSession } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { User, UserDocument } from '../schemas';
import { CreateUserDto, UpdateUserDto } from '../dtos';
import { generateLogin, generatePassword } from 'src/helpers';

interface UserTransactionProps {
  fullname: string;
  role: string;
  isActive?: boolean;
}

interface UpdateUserTransactionProps {
  id: string;
  user: Partial<UserTransactionProps>;
  updateCrendentials?: boolean;
  session: ClientSession;
}

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  public async createWithTransaction(user: UserTransactionProps, session: ClientSession) {
    const password = generatePassword();
    const login = generateLogin(user.fullname);

    const encryptPassword = this.encryptPassword(password);
    const createdUser = new this.userModel({ ...user, login, password: encryptPassword });
    await createdUser.save({ session });

    return { user: this.plainUser(createdUser), password };
  }

  public async updateWithTransaction({ id, user, session, updateCrendentials = false }: UpdateUserTransactionProps) {
    const userDB = await this.userModel.findById(id);

    if (!userDB) throw new NotFoundException(`User ${id} not found`);

    let password: string | null = null;

    if (updateCrendentials) {
      console.log('reset crendentials');
      const credentials = await this.resetCredentials(userDB, user.fullname, session);
      password = credentials.password;
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(id, user, { session, new: true });

    return { user: this.plainUser(updatedUser), password };
  }

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

  async create(userDto: CreateUserDto) {
    const password = generatePassword();
    const login = generateLogin(userDto.fullName);
    const encryptPassword = this.encryptPassword(password);
    const createdUser = new this.userModel({ ...userDto, login, password: encryptPassword });
    await createdUser.save();
    return this.plainUser(createdUser);
  }

  async update(id: string, userDto: UpdateUserDto) {
    const userDb = await this.userModel.findById(id);
    if (!userDb) throw new NotFoundException(`User ${id} not found`);
    const updatedUser = await this.userModel.findByIdAndUpdate(id, userDto, { new: true });
    return this.plainUser(updatedUser);
  }

  async resetCredentials(user: User, newFullName?: string, session?: ClientSession) {
    const login = generateLogin(newFullName ?? user.fullname);
    const password = generatePassword();
    const encryptPassword = this.encryptPassword(password);

    await this.userModel.updateOne(
      { _id: user._id },
      { login, password: encryptPassword, updatedPassword: false },
      session ? { session } : undefined,
    );
    return { login, password };
  }

  private encryptPassword(password: string): string {
    const salt = bcrypt.genSaltSync();
    return bcrypt.hashSync(password, salt);
  }

  private plainUser(user: UserDocument): User {
    const result = user instanceof Document ? user.toObject() : user;
    delete result.password;
    return result;
  }
}

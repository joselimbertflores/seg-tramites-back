import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, ClientSession, UpdateQuery, Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { generateLogin, generatePassword } from 'src/helpers';
import { CreateUserDto, UpdateUserDto } from '../dtos';
import { User, UserDocument } from '../schemas';

interface UserTransactionProps {
  fullname: string;
  role: string;
  isActive?: boolean;
}

interface UpdateUserTransactionProps {
  id: string;
  user: Partial<UserTransactionProps>;
  session: ClientSession;
  updateCredentials?: boolean;
}

interface UserTransactionResult {
  user: UserDocument;
  generatedPassword: string | null;
}

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  public async createWithTransaction(
    user: UserTransactionProps,
    session: ClientSession,
  ): Promise<UserTransactionResult> {
    const { login, password } = this.generateCrendentials(user.fullname);

    const encryptPassword = this.encryptPassword(password);

    const createdUser = new this.userModel({ ...user, login, password: encryptPassword });

    await createdUser.save({ session });

    return { user: createdUser, generatedPassword: password };
  }

  public async updateWithTransaction({ id, user, session, updateCredentials = false }: UpdateUserTransactionProps) {
    const updatedUser = await this.userModel.findByIdAndUpdate(id, user, { session, new: true });

    if (!updatedUser) throw new NotFoundException(`User ${id} not found`);

    let generatedPassword: string | null = null;

    if (updateCredentials) {
      const { password } = await this.resetCredentials(updatedUser);
      generatedPassword = password;
    }
    return { user: updatedUser, generatedPassword };
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
    const { login, password } = this.generateCrendentials(userDto.fullName);
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

  async resetCredentials(user: User) {
    const { login, password } = this.generateCrendentials(user.fullname);
    const encryptPassword = this.encryptPassword(password);
    await this.userModel.updateOne({ _id: user._id }, { login, password: encryptPassword, updatedPassword: false });
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

  private generateCrendentials(fullName: string) {
    const login = generateLogin(fullName);
    const password = generatePassword();
    return { login, password };
  }
}

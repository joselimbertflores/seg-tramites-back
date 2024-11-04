import { Injectable, InternalServerErrorException, NotFoundException, HttpException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';

import { OfficerService } from './officer.service';
import { Account } from '../schemas';
import { CreateAccountDto, CreateOfficerDto, FilterAccountDto, UpdateAccountDto } from '../dtos';
import { User, UserDocument } from 'src/modules/users/schemas';
import { CreateUserDto, UpdateUserDto } from 'src/modules/users/dtos';
import { UserService } from 'src/modules/users/services';

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectModel(User.name) private userModel: Model<User>,

    // !Delete after update
    @InjectConnection() private connection: mongoose.Connection,
    private userService: UserService,
    private officerService: OfficerService,
  ) {}

  async repairColection() {
    // const accounts = await this.accountModel.find({}).populate({
    //   path: 'funcionario',
    //   populate: {
    //     path: 'cargo',
    //   },
    // });
    // for (const account of accounts) {
    //   let newJob = '';
    //   if (!account.funcionario) {
    //     newJob = 'SIN DESIGNAR';
    //   } else {
    //     if (!account.funcionario.cargo) {
    //       newJob = 'SIN DESIGNAR';
    //     } else {
    //       newJob = account.funcionario.cargo.nombre;
    //     }
    //   }
    //   await this.accountModel.updateOne(
    //     { _id: account._id },
    //     { jobtitle: newJob },
    //   );
    // }
  }

  async generate() {
    // const accounts = await this.accountModel.find({}).populate('funcionario');
    // for (const element of accounts) {
    //   const { login, password, updatedPassword, activo, rol } = element;
    //   const fullname = element.funcionario
    //     ? [
    //         element.funcionario.nombre,
    //         element.funcionario.paterno,
    //         element.funcionario.materno,
    //       ]
    //         .filter(Boolean)
    //         .join(' ')
    //     : 'Unknown';
    //   const user = new this.userModel({
    //     fullname,
    //     login,
    //     password,
    //     updatedPassword,
    //     isActive: activo,
    //     role: rol,
    //   });
    //   await user.save();
    //   if (!element.isRoot) {
    //     await this.accountModel.updateOne(
    //       { _id: element._id },
    //       { user: user._id },
    //     );
    //   } else {
    //     console.log('un usuario root', element);
    //   }
    // }
  }

  async findAll({ dependency, limit, offset, term }: FilterAccountDto) {
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<Account> = {
      ...(dependency && {
        dependencia: new mongoose.Types.ObjectId(dependency),
      }),
      ...(term && {
        $or: [{ fullname: regex }, { 'officer.dni': regex }, { jobtitle: regex }],
      }),
    };
    const data = await this.accountModel
      .aggregate()
      .lookup({
        from: 'funcionarios',
        localField: 'officer',
        foreignField: '_id',
        as: 'officer',
      })
      .unwind({
        path: '$officer',
        preserveNullAndEmptyArrays: true,
      })
      .addFields({
        fullname: {
          $concat: [
            { $ifNull: ['$officer.nombre', ''] },
            ' ',
            { $ifNull: ['$officer.paterno', ''] },
            ' ',
            { $ifNull: ['$officer.materno', ''] },
          ],
        },
      })
      .match(query)
      .sort({ _id: -1 })
      .facet({
        paginatedResults: [{ $skip: offset }, { $limit: limit }],
        totalCount: [
          {
            $count: 'count',
          },
        ],
      });
    const accounts = data[0].paginatedResults;
    await this.accountModel.populate(accounts, [{ path: 'dependencia' }, { path: 'user', select: '-password' }]);
    const length = data[0].totalCount[0] ? data[0].totalCount[0].count : 0;
    return { accounts, length };
  }

  async update(id: string, userDto: UpdateUserDto, accountDto: UpdateAccountDto) {
    const accountDB = await this.accountModel.findById(id);
    if (!accountDB) throw new NotFoundException(`La cuenta ${id} no existe`);
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      await this.userService.update(accountDB.user._id, userDto, session);
      const updatedAccount = await this.accountModel
        .findByIdAndUpdate(id, accountDto, { new: true, session })
        .populate([{ path: 'dependencia' }, { path: 'officer' }, { path: 'user', select: '-password' }]);
      await session.commitTransaction();
      return updatedAccount;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    } finally {
      session.endSession();
    }
  }

  async create(userDto: CreateUserDto, accountDto: CreateAccountDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const userDb = await this.userService.create(userDto, session);
      const createdAccount = new this.accountModel({
        ...accountDto,
        user: userDb._id,
      });
      await createdAccount.save({ session });
      await session.commitTransaction();
      return await createdAccount.populate([
        { path: 'funcionario' },
        { path: 'dependencia' },
        { path: 'user', select: 'login role isActive' },
      ]);
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al crear cuenta');
    } finally {
      session.endSession();
    }
  }

  async searchActiveAccounts(term: string, limit = 5) {
    const regex = new RegExp(term, 'i');
    return await this.accountModel
      .aggregate()
      .match({ officer: { $ne: null } })
      .lookup({
        from: 'funcionarios',
        localField: 'officer',
        foreignField: '_id',
        as: 'officer',
      })
      .unwind({
        path: '$officer',
      })
      .addFields({
        fullname: {
          $concat: [
            { $ifNull: ['$officer.nombre', ''] },
            ' ',
            { $ifNull: ['$officer.paterno', ''] },
            ' ',
            { $ifNull: ['$officer.materno', ''] },
          ],
        },
      })
      .match({ fullname: regex, activo: true })
      .limit(limit)
      .project({ fullname: 0 });
  }

  async searchRecipients(currentAccountId: string, term: string) {
    const filterByDependency = isValidObjectId(term);
    const query = this.accountModel
      .aggregate()
      .match({
        _id: { $ne: currentAccountId },
        officer: { $ne: null },
        activo: true,
        isVisible: true,
      })
      .lookup({
        from: 'funcionarios',
        localField: 'officer',
        foreignField: '_id',
        as: 'officer',
      })
      .unwind({
        path: '$officer',
      })
      .addFields({
        fullname: {
          $concat: [
            { $ifNull: ['$officer.nombre', ''] },
            ' ',
            { $ifNull: ['$officer.paterno', ''] },
            ' ',
            { $ifNull: ['$officer.materno', ''] },
          ],
        },
      })
      .match({
        ...(filterByDependency ? { dependencia: new Types.ObjectId(term) } : { fullname: new RegExp(term, 'i') }),
      });
    if (!filterByDependency) query.limit(5);
    query.project({ fullname: 0 });
    const docs = await query;
    return await this.accountModel.populate(docs, { path: 'user', select: '-password' });
  }
}

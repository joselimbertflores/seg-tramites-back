import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';

import { OfficerService } from './officer.service';
import { Account, Dependency, Officer } from '../schemas';
import {
  CreateAccountDto,
  CreateAccountWithUserDto,
  CreateOfficerDto,
  FilterAccountDto,
  UpdateAccountDto,
} from '../dtos';
import { User, UserDocument } from 'src/modules/users/schemas';
import { CreateUserDto, UpdateUserDto } from 'src/modules/users/dtos';
import { UserService } from 'src/modules/users/services';

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectModel(Dependency.name) private dependencyModel: Model<Dependency>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Officer.name) private officerModel: Model<User>,

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

  async findAll(filterParams: FilterAccountDto) {
    const { dependency, institution, limit, offset, term } = filterParams;
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<Account> = {
      ...(dependency && {
        dependencia: new mongoose.Types.ObjectId(dependency),
      }),
      ...(institution && {
        institution: new mongoose.Types.ObjectId(institution),
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

  async create({ user, account }: CreateAccountWithUserDto) {
    const { officer, dependency } = await this.loadRequiredAccountProps(account);
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const createdUser = await this.userService.createWithTransaction(user, session);
      const createdAccount = new this.accountModel({
        user: createdUser,
        officer: officer,
        dependencia: dependency,
        institution: dependency.institucion,
        jobtitle: account.jobtitle,
        isVisible: account.isVisible,
      });
      await createdAccount.save({ session });
      await session.commitTransaction();
      console.log(createdAccount);
      return await createdAccount.populate([
        { path: 'funcionario' },
        { path: 'dependencia' },
        { path: 'user', select: '-password' },
      ]);
    } catch (error) {
      console.log(error);
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

  private async loadRequiredAccountProps({ officerId, dependencyId }: CreateAccountDto) {
    const [officer, dependency] = await Promise.all([
      this.officerModel.findById(officerId),
      this.dependencyModel.findById(dependencyId),
    ]);

    if (!officer || dependency) {
      throw new BadRequestException(`Parametros incorrectos Funcionario / Dependencia`);
    }
    return { officer, dependency };
  }
}

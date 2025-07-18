import {
  Injectable,
  HttpException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';

import { OfficerService } from './officer.service';
import { Account, Dependency, Officer } from '../schemas';
import { CreateAccountDto, CreateAccountWithUserDto, FilterAccountDto, UpdateAccountWithUserDto } from '../dtos';
import { getAccountAssignmentReport } from 'src/modules/printer/templates';
import { PrinterService } from 'src/modules/printer/printer.service';
import { MailService } from 'src/modules/mail/mail.service';
import { UserService } from 'src/modules/users/services';

@Injectable()
export class AccountService {
  constructor(
    @InjectConnection() private connection: mongoose.Connection,
    @InjectModel(Officer.name) private officerModel: Model<Officer>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectModel(Dependency.name) private dependencyModel: Model<Dependency>,
    private printerService: PrinterService,
    private userService: UserService,
    private officerService: OfficerService,
    private mailService: MailService,
  ) {}

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

  async create({ user, account }: CreateAccountWithUserDto) {
    const { officer, dependency } = await this.loadRequiredAccountProps(account);
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const resultTransaction = await this.userService.createWithTransaction(
        { ...user, fullname: officer.fullName },
        session,
      );
      const createdAccount = new this.accountModel({
        user: resultTransaction.user,
        officer: officer,
        dependencia: dependency,
        institution: dependency.institucion,
        jobtitle: account.jobtitle,
        isVisible: account.isVisible,
      });
      await createdAccount.save({ session });
      await session.commitTransaction();
      return await createdAccount.populate([
        { path: 'officer' },
        { path: 'dependencia' },
        { path: 'user', select: '-password -login' },
      ]);
    } catch (error) {
      await session.abortTransaction();
      this.handleErrors(error, 'Error creating account');
    } finally {
      session.endSession();
    }
  }

  async update(id: string, { user, account }: UpdateAccountWithUserDto) {
    let { officerId } = account ?? {};
    const accountDB = await this.accountModel.findById(id).populate('officer');

    if (!accountDB) throw new NotFoundException(`Account ${id} not found`);

    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      // let updateUSer = user;
      // if (officerId === null) {
      //   updateUSer = { isActive: false, fullname: 'SIN ASIGNAR' };
      //   console.log('Unlink account');
      //   // * Unlink account: Disable access in user and reset fullname
      //   await this.userService.updateWithTransaction({
      //     id: accountDB.user._id,
      //     user: { isActive: false, fullname: 'SIN ASIGNAR' },
      //     session,
      //   });
      // } else if (officerId && officerId !== accountDB.officer?.id) {
      //   // * Assign account: Restart crendetials
      //   console.log('Assign account');
      //   updateUSer = { fullname: newOfficer.fullName, ...user };

      //   const newOfficer = await this.officerModel.findById(officerId);
      //   if (!newOfficer) throw new BadRequestException(`Officer with ${id} not found`);
      //   officerId = newOfficer.id;
      //   await this.userService.updateWithTransaction({
      //     id: accountDB.user._id,
      //     user: { fullname: newOfficer.fullName, ...user },
      //     updateCrendentials: true,
      //     session,
      //   });
      // }
      // await this.userService.updateWithTransaction({
      //   id: accountDB.user._id,
      //   user: { fullname: newOfficer.fullName, ...user },
      //   updateCrendentials: true,
      //   session,
      // });
      console.log('update');
      const updatedAccount = await this.accountModel
        .findByIdAndUpdate(id, { ...account, officer: officerId }, { new: true, session })
        .populate([{ path: 'officer' }, { path: 'dependencia' }, { path: 'user', select: '-password -login' }]);

      await session.commitTransaction();
      return updatedAccount;
    } catch (error) {
      await session.abortTransaction();
      this.handleErrors(error, 'Error updating account');
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

  async resetAccountAccess(accountId: string) {
    const account = await this.accountModel.findById(accountId).populate('officer dependencia user');
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
    if (!account.officer) {
      throw new BadRequestException(`La cuenta no tiene funcionario asignado`);
    }
    const crendetials = await this.userService.resetCredentials(account.user, account.officer.fullName);

    const pdfContent = getAccountAssignmentReport({
      dependency: account.dependencia.nombre,
      fullName: account.officer.fullName,
      jobTitle: account.jobtitle,
      login: crendetials.login,
      password: crendetials.password,
    });

    const pdf = await this.printerService.createPdfBuffer(pdfContent);

    // if (account.officer.email) {
    //   await this.mailService.sendUserAssignment(
    //     account.officer.email,
    //     crendetials.newLogin,
    //     crendetials.newPassword,
    //     pdf,
    //   );
    // }
    return { pdf, newLogin: crendetials.login };
  }

  private async loadRequiredAccountProps({ officerId, dependencyId }: CreateAccountDto) {
    const [officer, dependency] = await Promise.all([
      this.officerModel.findById(officerId),
      this.dependencyModel.findById(dependencyId),
    ]);

    if (!officer || !dependency) {
      throw new BadRequestException(`Parametros incorrectos Funcionario / Dependencia`);
    }
    return { officer, dependency };
  }

  private handleErrors(error: unknown, originMessage: string) {
    console.log(error);
    if (error instanceof HttpException) throw error;
    if (error['code'] === 11000) {
      const key = Object.keys(error['keyPattern'])[0];
      throw new BadRequestException(
        key === 'officer' ? 'Officer selected is assigned in another account' : 'Duplicate properties',
      );
    }
    throw new InternalServerErrorException(originMessage);
  }
}

import {
  Injectable,
  HttpException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';

import { CreateAccountDto, CreateAccountWithUserDto, FilterAccountDto, UpdateAccountWithUserDto } from '../dtos';
import { getAccountAssignmentReport } from 'src/modules/printer/templates';
import { PrinterService } from 'src/modules/printer/printer.service';
import { MailService } from 'src/modules/notifications/services/mail.service';
import { UserService } from 'src/modules/users/services';
import { UpdateUserDto } from 'src/modules/users/dtos';
import { Account, Dependency, Officer } from '../schemas';

@Injectable()
export class AccountService {
  constructor(
    @InjectConnection() private connection: mongoose.Connection,
    @InjectModel(Officer.name) private officerModel: Model<Officer>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectModel(Dependency.name) private dependencyModel: Model<Dependency>,
    private printerService: PrinterService,
    private userService: UserService,
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
    const { officer, dependency } = await this.loadAccountProps(account);
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const userResult = await this.userService.create({ ...user, fullname: officer.fullName }, session);

      const createdAccount = new this.accountModel({
        user: userResult.user,
        officer: officer,
        dependencia: dependency,
        institution: dependency.institucion,
        jobtitle: account.jobtitle,
        isVisible: account.isVisible,
      });

      await createdAccount.save({ session });

      await session.commitTransaction();

      await createdAccount.populate([
        { path: 'officer' },
        { path: 'dependencia' },
        { path: 'user', select: '-password' },
      ]);

      const pdfBase64 = await this.generateAccountPdf(createdAccount, {
        login: userResult.user.login,
        password: userResult.generatedPassword,
      });

      return { account: createdAccount, pdfBase64 };
    } catch (error) {
      await session.abortTransaction();
      this.handleAccountErrors(error, 'Error creating account');
    } finally {
      session.endSession();
    }
  }

  async update(id: string, { user, account }: UpdateAccountWithUserDto) {
    const { officerId, ...toUpdateAccount } = account;

    const accountDB = await this.accountModel.findById(id).populate('officer');

    if (!accountDB) throw new NotFoundException(`Account ${id} not found`);

    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      // * Update user props
      const updateUserDto: UpdateUserDto = { ...user };
      let resetPassword = false;

      if (officerId === null) {
        updateUserDto.fullname = 'SIN ASIGNAR';
        updateUserDto.isActive = false;
      } else if (officerId && officerId !== accountDB.officer?.id) {
        const newOfficer = await this.officerModel.findById(officerId, null, { session });
        if (!newOfficer) throw new NotFoundException(`Officer with ${officerId} not found`);
        updateUserDto.fullname = newOfficer.fullName;
        resetPassword = true;
      }

      const userUpdateResult = await this.userService.updateWithTransaction({
        id: accountDB.user._id,
        user: updateUserDto,
        resetPassword,
        session,
      });

      const updatedAccount = await this.accountModel
        .findByIdAndUpdate(id, { ...toUpdateAccount, officer: officerId }, { new: true, session })
        .populate([{ path: 'officer' }, { path: 'dependencia' }, { path: 'user', select: '-password' }]);

      await session.commitTransaction();

      const pdfBase64 = userUpdateResult.generatedPassword
        ? await this.generateAccountPdf(updatedAccount, {
            login: updatedAccount.user.login,
            password: userUpdateResult.generatedPassword,
          })
        : null;

      return { account: updatedAccount, pdfBase64 };
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      this.handleAccountErrors(error, 'Error updating account');
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
      .match({ fullname: regex, isVisible: true })
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

  async resetAccountPassword(accountId: string) {
    const account = await this.accountModel
      .findById(accountId)
      .populate([{ path: 'officer' }, { path: 'dependencia' }, { path: 'user', select: '-password' }]);

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const { password } = await this.userService.resetPassword(account.user);

    const pdfBase64 = await this.generateAccountPdf(account, { login: account.user.login, password });
    // this.mailService.sendUserAssignment('work000100@gmail.com', "");
    return { pdfBase64 };
  }

  private async loadAccountProps({ officerId, dependencyId }: CreateAccountDto) {
    const [officer, dependency] = await Promise.all([
      this.officerModel.findById(officerId),
      this.dependencyModel.findById(dependencyId),
    ]);

    if (!officer || !dependency) {
      throw new BadRequestException(`Parametros incorrectos Funcionario / Dependencia`);
    }
    return { officer, dependency };
  }

  private handleAccountErrors(error: unknown, originMessage: string) {
    if (error instanceof HttpException) throw error;
    if (error['code'] === 11000) {
      const key = Object.keys(error['keyPattern'])[0];
      throw new BadRequestException(
        key === 'officer' ? 'El funcionario seleccionado ya tiene una cuenta asignada' : 'Duplicate properties',
      );
    }
    throw new InternalServerErrorException(originMessage);
  }

  private async generateAccountPdf(account: Account, crendetials: { login: string; password: string }) {
    const pdfContent = getAccountAssignmentReport(account, {
      login: crendetials.login,
      password: crendetials.password,
    });
    const pdf = await this.printerService.createPdfBuffer(pdfContent);
    return pdf.toString('base64');
  }
}

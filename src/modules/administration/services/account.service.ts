import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';

import { AssignAccountDto, CreateAccountDto, FilterAccountDto, UpdateAccountDto } from '../dtos';
import { getAccountAssignmentReport } from 'src/modules/printer/templates';
import { PrinterService } from 'src/modules/printer/printer.service';
import { MailService } from 'src/modules/notifications/services/mail.service';
import { RoleService, UserService } from 'src/modules/users/services';
import { User } from 'src/modules/users/schemas';
import { Account, Dependency, Officer } from '../schemas';

@Injectable()
export class AccountService {
  constructor(
    @InjectConnection() private connection: mongoose.Connection,
    @InjectModel(Officer.name) private officerModel: Model<Officer>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectModel(Dependency.name) private dependencyModel: Model<Dependency>,
    @InjectModel(User.name) private userModel: Model<User>,
    private printerService: PrinterService,
    private userService: UserService,
    private roleService: RoleService,
    private mailService: MailService,
  ) {}

  async findAll(filterParams: FilterAccountDto) {
    const { dependency, institution, limit, offset, term } = filterParams;
    const regex = new RegExp(term, 'i');
    const query: FilterQuery<Account> = {
      ...(dependency && { dependencia: new mongoose.Types.ObjectId(dependency) }),
      ...(institution && { institution: new mongoose.Types.ObjectId(institution) }),
      ...(term && { $or: [{ fullname: regex }, { 'officer.dni': regex }, { jobtitle: regex }] }),
    };
    const data = await this.accountModel
      .aggregate()
      .lookup({
        from: 'funcionarios',
        localField: 'officer',
        foreignField: '_id',
        as: 'officer',
      })
      .unwind({ path: '$officer', preserveNullAndEmptyArrays: true })
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
        totalCount: [{ $count: 'count' }],
      });
    const accounts = data[0].paginatedResults;
    await this.accountModel.populate(accounts, [
      { path: 'dependencia' },
      { path: 'user', select: '-password' },
      { path: 'role' },
    ]);
    const length = data[0].totalCount[0]?.count ?? 0;
    return { accounts, length };
  }

  async create(account: CreateAccountDto) {
    const [dependency, role] = await Promise.all([
      this.requireDependency(account.dependencyId),
      this.roleService.requireRole(account.roleId),
    ]);

    try {
      const createdAccount = await this.accountModel.create({
        user: null,
        officer: null,
        role,
        dependencia: dependency,
        institution: dependency.institucion,
        jobtitle: account.jobtitle,
        isVisible: account.isVisible,
        employmentType: account.employmentType,
      });
      return await this.populateAccount(createdAccount);
    } catch (error) {
      this.handleAccountErrors(error, 'Error creating account');
    }
  }

  async update(id: string, account: UpdateAccountDto) {
    const accountDB = await this.accountModel.findById(id);
    if (!accountDB) throw new NotFoundException(`Account ${id} not found`);

    const { dependencyId, roleId, ...properties } = account;
    const [dependency, role] = await Promise.all([
      dependencyId ? this.requireDependency(dependencyId) : null,
      roleId ? this.roleService.requireRole(roleId) : null,
    ]);
    const update = {
      ...properties,
      ...(dependency && { dependencia: dependency, institution: dependency.institucion }),
      ...(role && { role }),
    };

    try {
      const updated = await this.accountModel.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      });
      return await this.populateAccount(updated);
    } catch (error) {
      this.handleAccountErrors(error, 'Error updating account');
    }
  }

  async assign(id: string, { userId, officerId }: AssignAccountDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const [account, user, officer] = await Promise.all([
        this.accountModel.findById(id, null, { session }),
        this.userModel.findById(userId, null, { session }),
        this.officerModel.findById(officerId, null, { session }),
      ]);

      if (!account) throw new NotFoundException(`Account ${id} not found`);
      if (!user) throw new NotFoundException(`User ${userId} not found`);
      if (!officer) throw new NotFoundException(`Officer ${officerId} not found`);
      if (!user.isActive) throw new BadRequestException(`User ${userId} is inactive`);
      if (!officer.activo) throw new BadRequestException(`Officer ${officerId} is inactive`);
      if (this.normalizeName(user.fullname) !== this.normalizeName(officer.fullName)) {
        throw new BadRequestException(`User ${userId} does not correspond to officer ${officerId}`);
      }

      const conflict = await this.accountModel.findOne(
        { _id: { $ne: account._id }, $or: [{ user: user._id }, { officer: officer._id }] },
        null,
        { session },
      );
      if (conflict) {
        const property = String(conflict.user) === String(user._id) ? 'User' : 'Officer';
        throw new BadRequestException(`${property} is already assigned to account ${conflict.id}`);
      }

      account.user = user;
      account.officer = officer;
      await account.save({ session });
      await session.commitTransaction();
      return await this.populateAccount(account);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      this.handleAccountErrors(error, 'Error assigning account');
    } finally {
      await session.endSession();
    }
  }

  async unassign(id: string) {
    const account = await this.accountModel.findById(id);
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    account.user = null;
    account.officer = null;
    await account.save();
    return await this.populateAccount(account);
  }

  async searchUsersWithoutAccount(term: string, limit = 5) {
    return await this.userModel
      .aggregate()
      .match({ isActive: true, ...(term && { fullname: new RegExp(term, 'i') }) })
      .lookup({
        from: 'cuentas',
        localField: '_id',
        foreignField: 'user',
        as: 'accounts',
      })
      .match({ accounts: { $size: 0 } })
      .project({ password: 0, accounts: 0 })
      .limit(limit);
  }

  async searchActiveAccounts(term: string, limit = 5) {
    const regex = new RegExp(term, 'i');
    return await this.accountModel
      .aggregate()
      .match({ officer: { $type: 'objectId' }, user: { $type: 'objectId' } })
      .lookup({
        from: 'funcionarios',
        localField: 'officer',
        foreignField: '_id',
        as: 'officer',
      })
      .unwind({ path: '$officer' })
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
        _id: { $ne: new Types.ObjectId(currentAccountId) },
        officer: { $type: 'objectId' },
        user: { $type: 'objectId' },
        isVisible: true,
      })
      .lookup({
        from: 'funcionarios',
        localField: 'officer',
        foreignField: '_id',
        as: 'officer',
      })
      .unwind({ path: '$officer' })
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
      .match(filterByDependency ? { dependencia: new Types.ObjectId(term) } : { fullname: new RegExp(term, 'i') });
    if (!filterByDependency) query.limit(5);
    query.project({ fullname: 0 });
    const docs = await query;
    return await this.accountModel.populate(docs, { path: 'user', select: '-password' });
  }

  async resetAccountPassword(accountId: string, generatedBy: string) {
    const account = await this.accountModel
      .findById(accountId)
      .populate([{ path: 'officer' }, { path: 'dependencia' }, { path: 'user', select: '-password' }]);
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    if (!account.user || !account.officer) throw new BadRequestException(`Account ${accountId} is not assigned`);

    const { password } = await this.userService.resetPassword(account.user);
    const pdf = await this.generateAccountPdf(account, { login: account.user.login, password }, generatedBy);
    let mailResult = null;
    if (account.officer.email) {
      mailResult = await this.mailService.sendUserAssignment({
        type: 'RESET',
        pdfBuffer: pdf,
        attachmentName: `Credenciales - ${account.officer.fullName}`,
        email: account.officer.email,
      });
    }
    return { pdfBase64: pdf.toString('base64'), ...(mailResult && { mail: mailResult }) };
  }

  private async requireDependency(dependencyId: string) {
    const dependency = await this.dependencyModel.findById(dependencyId);
    if (!dependency) throw new BadRequestException(`Dependency ${dependencyId} not found`);
    return dependency;
  }

  private normalizeName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private async populateAccount(account: Account) {
    return await account.populate([
      { path: 'officer' },
      { path: 'dependencia' },
      { path: 'institution' },
      { path: 'role' },
      { path: 'user', select: '-password' },
    ]);
  }

  private handleAccountErrors(error: unknown, originMessage: string): never {
    if (error instanceof HttpException) throw error;
    if (error?.['code'] === 11000) {
      const key = Object.keys(error['keyPattern'] ?? {})[0];
      const messages = {
        officer: 'El funcionario seleccionado ya tiene una cuenta asignada',
        user: 'El usuario seleccionado ya tiene una cuenta asignada',
      };
      throw new BadRequestException(messages[key] ?? 'Duplicate properties');
    }
    throw new InternalServerErrorException(originMessage);
  }

  private async generateAccountPdf(
    account: Account,
    credentials: { login: string; password: string },
    generatedBy: string,
  ) {
    const pdfContent = getAccountAssignmentReport(account, credentials, generatedBy);
    return await this.printerService.createPdfBuffer(pdfContent);
  }
}

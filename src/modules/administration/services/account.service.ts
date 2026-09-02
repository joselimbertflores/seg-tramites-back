import {
  BadRequestException,
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';

import { CreateAccountDto, FilterAccountDto, UpdateAccountDto } from '../dtos';
import { getAccountAssignmentReport } from 'src/modules/printer/templates';
import { PrinterService } from 'src/modules/printer/printer.service';
import { MailService } from 'src/modules/notifications/services/mail.service';
import {
  IdentityHubAssignableUser,
  IdentityHubUsersClientService,
  RoleService,
  UserService,
} from 'src/modules/users/services';
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
    private roleService: RoleService,
    private mailService: MailService,
    private identityHubUsersClient: IdentityHubUsersClientService,
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
      { path: 'institution' },
      { path: 'user', select: '-password' },
      { path: 'role' },
    ]);
    const length = data[0].totalCount[0]?.count ?? 0;
    return { accounts, length };
  }

  async create(account: CreateAccountDto) {
    const { assigneeExternalKey, ...accountProperties } = account;
    const [dependency, role] = await Promise.all([
      this.requireDependency(account.dependencyId),
      this.roleService.requireRole(account.roleId),
    ]);
    const identity = assigneeExternalKey ? await this.requireIdentityUser(assigneeExternalKey) : null;

    const session = await this.connection.startSession();

    try {
      session.startTransaction();
      const [createdAccount] = await this.accountModel.create(
        [
          {
            user: null,
            officer: null,
            role,
            dependencia: dependency,
            institution: dependency.institucion,
            jobtitle: accountProperties.jobtitle,
            isVisible: accountProperties.isVisible,
            employmentType: accountProperties.employmentType,
          },
        ],
        { session },
      );

      if (identity) {
        const assignee = await this.resolveAssignee(identity, createdAccount._id, session);
        createdAccount.user = assignee.user;
        createdAccount.officer = assignee.officer;
        await createdAccount.save({ session });
      }

      await session.commitTransaction();
      return await this.populateAccount(createdAccount);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      this.handleAccountErrors(error, 'Error creating account');
    } finally {
      await session.endSession();
    }
  }

  async update(id: string, account: UpdateAccountDto) {
    const changesAssignment = Object.prototype.hasOwnProperty.call(account, 'assigneeExternalKey');
    const { dependencyId, roleId, assigneeExternalKey, ...properties } = account;
    const [dependency, role] = await Promise.all([
      dependencyId ? this.requireDependency(dependencyId) : null,
      roleId ? this.roleService.requireRole(roleId) : null,
    ]);
    const identity =
      changesAssignment && assigneeExternalKey ? await this.requireIdentityUser(assigneeExternalKey) : null;

    const session = await this.connection.startSession();

    try {
      session.startTransaction();
      const accountDB = await this.accountModel.findById(id, null, { session });
      if (!accountDB) throw new NotFoundException(`Account ${id} not found`);

      Object.assign(accountDB, properties);
      if (dependency) {
        accountDB.dependencia = dependency;
        accountDB.institution = dependency.institucion;
      }
      if (role) accountDB.role = role;

      if (changesAssignment) {
        if (identity) {
          const assignee = await this.resolveAssignee(identity, accountDB._id, session);
          accountDB.user = assignee.user;
          accountDB.officer = assignee.officer;
        } else {
          accountDB.user = null;
          accountDB.officer = null;
        }
      }

      await accountDB.save({ session });
      await session.commitTransaction();
      return await this.populateAccount(accountDB);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      this.handleAccountErrors(error, 'Error updating account');
    } finally {
      await session.endSession();
    }
  }

  async searchIdentityCandidates(term: string) {
    const normalizedTerm = term?.trim() ?? '';
    if (normalizedTerm.length < 3) return [];
    return await this.identityHubUsersClient.searchAssignableUsers(normalizedTerm);
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
    if (!account.user.login || account.user.externalKey) {
      throw new BadRequestException('El usuario institucional no utiliza credenciales locales para restablecer');
    }

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

  private async requireIdentityUser(externalKey: string) {
    const identity = await this.identityHubUsersClient.findAssignableUserByExternalKey(externalKey);
    if (identity.externalKey !== externalKey) {
      throw new BadGatewayException('Identity Hub devolvió una identidad distinta a la solicitada');
    }
    return identity;
  }

  private async resolveAssignee(
    identity: IdentityHubAssignableUser,
    accountId: mongoose.Types.ObjectId,
    session: mongoose.ClientSession,
  ) {
    const relationKey = identity.relationKey?.trim();
    if (!relationKey) {
      throw new BadRequestException(
        'El usuario institucional no tiene un documento de identidad asociado y no puede vincularse a un funcionario',
      );
    }

    const officer = await this.officerModel.findOne({ dni: relationKey }, null, { session });
    if (!officer) {
      throw new BadRequestException(
        'No existe un funcionario de Seguimiento de Trámites asociado a esta identidad institucional',
      );
    }
    if (!officer.activo) {
      throw new BadRequestException('El funcionario asociado a la identidad institucional está inactivo');
    }

    const user = await this.userService.findOrCreateIdentityShadow(identity, session);
    const conflict = await this.accountModel.findOne(
      {
        _id: { $ne: accountId },
        $or: [{ user: user._id }, { officer: officer._id }],
      },
      null,
      { session },
    );

    if (conflict) {
      const property = String(conflict.user) === String(user._id) ? 'usuario' : 'funcionario';
      throw new BadRequestException(`El ${property} seleccionado ya ocupa otra Account`);
    }

    return { user, officer };
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
        externalKey: 'La identidad institucional ya tiene un usuario local asociado',
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

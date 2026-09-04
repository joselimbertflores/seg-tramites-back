import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { config } from 'dotenv';
import mongoose, { ClientSession, Types } from 'mongoose';
import { Account, AccountSchema, Officer, OfficerSchema } from '../src/modules/administration/schemas';
import { User, UserSchema } from '../src/modules/users/schemas';

config();

interface IdentityMapping {
  userId: string;
  externalKey: string;
  relationKey: string;
}

interface MappingInput {
  mappings: IdentityMapping[];
}

interface StoredUser {
  _id: Types.ObjectId;
  externalKey?: unknown;
}

interface StoredAccount {
  _id: Types.ObjectId;
  user?: Types.ObjectId | null;
  officer?: Types.ObjectId | null;
}

interface StoredOfficer {
  _id: Types.ObjectId;
  dni?: unknown;
}

interface Finding {
  index: number;
  userId?: string;
  accountId?: string;
  officerId?: string;
  reason: string;
}

interface PreparedMapping {
  index: number;
  mapping: IdentityMapping;
  user: StoredUser;
  account?: StoredAccount;
  officer?: StoredOfficer;
}

function id(value?: Types.ObjectId | null) {
  return value?.toString() ?? null;
}

function hasExpectedExternalKey(value: unknown, expected: string) {
  return !value || value === expected;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function repeatedValues(mappings: IdentityMapping[], property: keyof IdentityMapping) {
  const counts = new Map<string, number>();
  for (const mapping of mappings) {
    const value = mapping?.[property];
    if (isNonEmptyString(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');
  if (dryRun === apply) throw new Error('Use exactly one mode: --dry-run or --apply');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const inputPath = resolve(__dirname, '../migration-data/seguimiento-identity-mapping.json');
  const input = JSON.parse(await readFile(inputPath, 'utf8')) as MappingInput;
  if (!Array.isArray(input.mappings)) throw new Error('Input must contain a mappings array');

  const repeatedUserIds = repeatedValues(input.mappings, 'userId');
  const repeatedExternalKeys = repeatedValues(input.mappings, 'externalKey');
  const repeatedRelationKeys = repeatedValues(input.mappings, 'relationKey');

  await mongoose.connect(databaseUrl, { autoIndex: false, autoCreate: false });

  const UserModel = mongoose.model(User.name, UserSchema);
  const AccountModel = mongoose.model(Account.name, AccountSchema);
  const OfficerModel = mongoose.model(Officer.name, OfficerSchema);
  const unresolved: Finding[] = [];
  const conflicts: Finding[] = [];
  const warnings: Finding[] = [];
  const prepared: PreparedMapping[] = [];

  for (const [index, mapping] of input.mappings.entries()) {
    if (
      !mapping ||
      !isNonEmptyString(mapping.userId) ||
      !Types.ObjectId.isValid(mapping.userId) ||
      !isNonEmptyString(mapping.externalKey) ||
      !isNonEmptyString(mapping.relationKey)
    ) {
      unresolved.push({ index, userId: mapping?.userId, reason: 'Mapping inválido' });
      continue;
    }

    const repeatedProperties = [
      repeatedUserIds.has(mapping.userId) && 'userId',
      repeatedExternalKeys.has(mapping.externalKey) && 'externalKey',
      repeatedRelationKeys.has(mapping.relationKey) && 'relationKey',
    ].filter(Boolean);
    if (repeatedProperties.length) {
      conflicts.push({
        index,
        userId: mapping.userId,
        reason: `Valores repetidos en mappings: ${repeatedProperties.join(', ')}`,
      });
      continue;
    }

    const user = (await UserModel.findById(mapping.userId)
      .select({ _id: 1, externalKey: 1 })
      .lean()
      .exec()) as StoredUser | null;
    if (!user) {
      unresolved.push({ index, userId: mapping.userId, reason: 'User no existe' });
      continue;
    }

    const currentExternalKey = user.externalKey;
    if (currentExternalKey && currentExternalKey !== mapping.externalKey) {
      conflicts.push({ index, userId: mapping.userId, reason: 'User tiene un externalKey diferente' });
      continue;
    }

    const externalKeyOwner = (await UserModel.findOne({
      _id: { $ne: user._id },
      externalKey: mapping.externalKey,
    })
      .select({ _id: 1 })
      .lean()
      .exec()) as Pick<StoredUser, '_id'> | null;
    if (externalKeyOwner) {
      conflicts.push({
        index,
        userId: mapping.userId,
        reason: `externalKey pertenece a otro User: ${id(externalKeyOwner._id)}`,
      });
      continue;
    }

    const accounts = (await AccountModel.find({ user: user._id })
      .select({ _id: 1, user: 1, officer: 1 })
      .lean()
      .exec()) as unknown as StoredAccount[];
    if (accounts.length > 1) {
      unresolved.push({ index, userId: mapping.userId, reason: 'User asociado a múltiples Accounts' });
      continue;
    }

    const account = accounts[0];
    if (!account) {
      warnings.push({ index, userId: mapping.userId, reason: 'User sin Account; sólo se actualizará externalKey' });
      prepared.push({ index, mapping, user });
      continue;
    }

    const accountId = id(account._id) ?? undefined;
    const officerId = id(account.officer);
    if (!officerId) {
      warnings.push({
        index,
        userId: mapping.userId,
        accountId,
        reason: 'Account sin Officer; sólo se actualizará externalKey',
      });
      prepared.push({ index, mapping, user, account });
      continue;
    }

    const officer = (await OfficerModel.findById(officerId)
      .select({ _id: 1, dni: 1 })
      .lean()
      .exec()) as StoredOfficer | null;
    if (!officer) {
      warnings.push({
        index,
        userId: mapping.userId,
        accountId,
        officerId,
        reason: 'Officer referenciado no existe; sólo se actualizará externalKey',
      });
      prepared.push({ index, mapping, user, account });
      continue;
    }

    if (officer.dni !== mapping.relationKey) {
      const relationKeyOwner = (await OfficerModel.findOne({
        _id: { $ne: officer._id },
        dni: mapping.relationKey,
      })
        .select({ _id: 1 })
        .lean()
        .exec()) as Pick<StoredOfficer, '_id'> | null;
      if (relationKeyOwner) {
        conflicts.push({
          index,
          userId: mapping.userId,
          accountId,
          officerId,
          reason: `relationKey pertenece a otro Officer: ${id(relationKeyOwner._id)}`,
        });
        continue;
      }
    }

    prepared.push({ index, mapping, user, account, officer });
  }

  const userUpdates = prepared.filter(({ user, mapping }) => user.externalKey !== mapping.externalKey);
  const officerUpdates = prepared.filter(
    ({ officer, mapping }) => officer && officer.dni !== mapping.relationKey,
  ) as Array<PreparedMapping & { officer: StoredOfficer }>;
  const report = {
    mode: dryRun ? 'dry-run' : 'apply',
    totals: {
      mappings: input.mappings.length,
      valid: prepared.length,
      unresolved: unresolved.length,
      conflicts: conflicts.length,
      warnings: warnings.length,
      userUpdates: userUpdates.length,
      usersAlreadyMapped: prepared.length - userUpdates.length,
      officerUpdates: officerUpdates.length,
      officersAlreadyCanonical: prepared.filter(
        ({ officer, mapping }) => officer && officer.dni === mapping.relationKey,
      ).length,
    },
    unresolved,
    conflicts,
    warnings,
  };

  console.log(JSON.stringify(report, null, 2));
  if (dryRun) return;

  const assertPreconditions = async (session?: ClientSession) => {
    const userIds = prepared.map(({ user }) => user._id);
    const officerIds = prepared.flatMap(({ officer }) => (officer ? [officer._id] : []));
    const options = { ...(session && { session }) };
    const [currentUsers, currentAccounts, currentOfficers] = await Promise.all([
      UserModel.collection
        .find({ _id: { $in: userIds } }, { projection: { _id: 1, externalKey: 1 }, ...options })
        .toArray() as unknown as Promise<StoredUser[]>,
      AccountModel.collection
        .find({ user: { $in: userIds } }, { projection: { _id: 1, user: 1, officer: 1 }, ...options })
        .toArray() as unknown as Promise<StoredAccount[]>,
      OfficerModel.collection
        .find({ _id: { $in: officerIds } }, { projection: { _id: 1, dni: 1 }, ...options })
        .toArray() as unknown as Promise<StoredOfficer[]>,
    ]);
    const currentUsersById = new Map(currentUsers.map((user) => [id(user._id), user]));
    const currentAccountsByUserId = new Map<string, StoredAccount[]>();
    for (const account of currentAccounts) {
      const userId = id(account.user);
      if (userId) currentAccountsByUserId.set(userId, [...(currentAccountsByUserId.get(userId) ?? []), account]);
    }
    const currentOfficersById = new Map(currentOfficers.map((officer) => [id(officer._id), officer]));
    const changes: Finding[] = [];

    for (const { index, mapping, user, account, officer } of prepared) {
      const currentUser = currentUsersById.get(mapping.userId);
      if (!currentUser || !hasExpectedExternalKey(currentUser.externalKey, mapping.externalKey)) {
        changes.push({ index, userId: mapping.userId, reason: 'User cambió después de la validación' });
        continue;
      }

      const currentUserAccounts = currentAccountsByUserId.get(mapping.userId) ?? [];
      const currentAccount = currentUserAccounts[0];
      const accountChanged = account
        ? currentUserAccounts.length !== 1 ||
          id(currentAccount?._id) !== id(account._id) ||
          id(currentAccount?.user) !== id(user._id) ||
          id(currentAccount?.officer) !== id(account.officer)
        : currentUserAccounts.length !== 0;
      if (accountChanged) {
        changes.push({
          index,
          userId: mapping.userId,
          accountId: id(account?._id) ?? undefined,
          reason: 'Account cambió después de la validación',
        });
        continue;
      }

      if (officer) {
        const currentOfficer = currentOfficersById.get(id(officer._id));
        if (!currentOfficer || !Object.is(currentOfficer.dni, officer.dni)) {
          changes.push({
            index,
            userId: mapping.userId,
            accountId: id(account?._id) ?? undefined,
            officerId: id(officer._id) ?? undefined,
            reason: 'Officer.dni cambió después de la validación',
          });
        }
      }
    }

    if (changes.length) throw new Error(`State changed after validation: ${JSON.stringify(changes)}`);
  };

  const applyUpdates = async (session?: ClientSession) => {
    await assertPreconditions(session);

    if (userUpdates.length) {
      const result = await UserModel.collection.bulkWrite(
        userUpdates.map(({ user, mapping }) => ({
          updateOne: {
            filter: {
              _id: user._id,
              $or: [
                { externalKey: { $exists: false } },
                { externalKey: null },
                { externalKey: '' },
                { externalKey: mapping.externalKey },
              ],
            },
            update: { $set: { externalKey: mapping.externalKey } },
          },
        })),
        { ordered: true, ...(session && { session }) },
      );
      if (result.matchedCount !== userUpdates.length) throw new Error('Users changed after validation; aborting');
    }

    if (officerUpdates.length) {
      const result = await OfficerModel.collection.bulkWrite(
        officerUpdates.map(({ officer, mapping }) => ({
          updateOne: {
            filter: {
              _id: officer._id,
              dni: officer.dni === undefined ? { $exists: false } : officer.dni,
            },
            update: { $set: { dni: mapping.relationKey } },
          },
        })),
        { ordered: true, ...(session && { session }) },
      );
      if (result.matchedCount !== officerUpdates.length) {
        throw new Error(
          `Officers changed after validation; expected ${officerUpdates.length}, matched ${result.matchedCount}`,
        );
      }
    }
  };

  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (hello.setName || hello.msg === 'isdbgrid') {
    const session = await mongoose.connection.startSession();
    try {
      await session.withTransaction(() => applyUpdates(session));
    } finally {
      await session.endSession();
    }
  } else {
    console.warn('MongoDB standalone detected: applying prevalidated idempotent updates without a transaction.');
    await applyUpdates();
  }

  console.log(`Applied ${prepared.length} valid mappings.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

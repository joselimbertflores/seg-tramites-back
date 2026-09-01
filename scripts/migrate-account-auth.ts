import { config } from 'dotenv';
import mongoose, { ClientSession, Types } from 'mongoose';
import { SYSTEM_RESOURCES } from '../src/modules/auth/constants';

config();

interface LegacyRole {
  _id: Types.ObjectId;
  name: string;
  permissions?: { resource: string; actions: string[] }[];
}

interface LegacyUser {
  _id: Types.ObjectId;
  fullname?: string;
  role?: Types.ObjectId | null;
  roles?: Types.ObjectId[];
}

interface LegacyOfficer {
  _id: Types.ObjectId;
  nombre?: string;
  paterno?: string;
  materno?: string;
}

interface LegacyAccount {
  _id: Types.ObjectId;
  user?: Types.ObjectId | null;
  officer?: Types.ObjectId | null;
  role?: Types.ObjectId | null;
}

const dryRun = process.argv.includes('--dry-run');
const vacantUserNames = new Set(
  (process.env.MIGRATION_VACANT_USERS ?? 'SIN ASIGNAR,SIN FUNCIONARIO,VACANTE,ACEFALO')
    .split(',')
    .map(normalize)
    .filter(Boolean),
);
const validActionsByResource = new Map(
  SYSTEM_RESOURCES.map(({ value, actions }) => [value as string, new Set(actions.map(({ value: action }) => action))]),
);

function normalize(value?: string) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function id(value?: Types.ObjectId | null) {
  return value ? value.toString() : null;
}

function isArtificialVacancy(user?: LegacyUser | null) {
  return !!user && vacantUserNames.has(normalize(user.fullname));
}

function groupDuplicates(values: { accountId: string; value: string | null }[]) {
  const grouped = new Map<string, string[]>();
  for (const { accountId, value } of values) {
    if (!value) continue;
    grouped.set(value, [...(grouped.get(value) ?? []), accountId]);
  }
  return [...grouped.entries()]
    .filter(([, accountIds]) => accountIds.length > 1)
    .map(([value, accountIds]) => ({ value, accountIds }));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  await mongoose.connect(databaseUrl, { autoIndex: false });
  const db = mongoose.connection.db;
  const usersCollection = db.collection<LegacyUser>('users');
  const rolesCollection = db.collection<LegacyRole>('roles');
  const accountsCollection = db.collection<LegacyAccount>('cuentas');
  const officersCollection = db.collection<LegacyOfficer>('funcionarios');

  const [users, roles, accounts, officers] = await Promise.all([
    usersCollection.find({}).toArray(),
    rolesCollection.find({}).toArray(),
    accountsCollection.find({}).toArray(),
    officersCollection.find({}).toArray(),
  ]);

  const usersById = new Map(users.map((user) => [id(user._id), user]));
  const rolesById = new Map(roles.map((role) => [id(role._id), role]));
  const officersById = new Map(officers.map((officer) => [id(officer._id), officer]));
  const accountsByUser = new Map<string, LegacyAccount[]>();

  for (const account of accounts) {
    const userId = id(account.user);
    if (userId) accountsByUser.set(userId, [...(accountsByUser.get(userId) ?? []), account]);
  }

  const missingReferences: object[] = [];
  const uninterpretablePartialAccounts: object[] = [];
  const legacyVacantAccounts: object[] = [];
  const fullnameMismatches: object[] = [];
  const accountsWithoutRole: object[] = [];
  const accountRoleConflicts: object[] = [];
  const usedRoleIds = new Set<string>();

  for (const account of accounts) {
    const accountId = id(account._id);
    const userId = id(account.user);
    const officerId = id(account.officer);
    const accountRoleId = id(account.role);
    const user = userId ? usersById.get(userId) : null;
    const officer = officerId ? officersById.get(officerId) : null;
    const legacyUserRoleId = id(user?.role);

    if (userId && !user) missingReferences.push({ accountId, property: 'user', reference: userId });
    if (officerId && !officer) missingReferences.push({ accountId, property: 'officer', reference: officerId });
    if (accountRoleId && !rolesById.has(accountRoleId)) {
      missingReferences.push({ accountId, property: 'role', reference: accountRoleId });
    }

    if (Boolean(userId) !== Boolean(officerId)) {
      if (user && !officerId && isArtificialVacancy(user)) {
        legacyVacantAccounts.push({ accountId, userId, legacyRoleId: legacyUserRoleId, accountRoleId });
      } else {
        uninterpretablePartialAccounts.push({ accountId, userId, officerId });
      }
    }

    if (user && officer) {
      const officerName = normalize([officer.nombre, officer.paterno, officer.materno].filter(Boolean).join(' '));
      if (normalize(user.fullname) !== officerName) {
        fullnameMismatches.push({ accountId, userId, officerId, userName: user.fullname, officerName });
      }
    }

    if (accountRoleId && legacyUserRoleId && accountRoleId !== legacyUserRoleId) {
      accountRoleConflicts.push({ accountId, userId, accountRoleId, legacyUserRoleId });
    }

    const roleId = accountRoleId ?? legacyUserRoleId;
    if (!roleId || !rolesById.has(roleId)) {
      accountsWithoutRole.push({ accountId, accountRoleId, legacyUserRoleId });
    } else {
      usedRoleIds.add(roleId);
    }
  }

  const usersWithConflictingRoleModels: object[] = [];
  for (const user of users) {
    const userId = id(user._id);
    const legacyRoleId = id(user.role);
    const currentRoleIds = (user.roles ?? []).map((roleId) => id(roleId));

    if (legacyRoleId && !rolesById.has(legacyRoleId)) {
      missingReferences.push({ userId, property: 'role', reference: legacyRoleId });
    }
    for (const roleId of currentRoleIds) {
      if (roleId && !rolesById.has(roleId)) {
        missingReferences.push({ userId, property: 'roles', reference: roleId });
      }
      if (roleId) usedRoleIds.add(roleId);
    }
    if (legacyRoleId && currentRoleIds.length) {
      usersWithConflictingRoleModels.push({ userId, legacyRoleId, roles: currentRoleIds });
    }

    if (!accountsByUser.has(userId) && legacyRoleId) usedRoleIds.add(legacyRoleId);
  }

  const duplicateUserAssignments = groupDuplicates(
    accounts.map((account) => ({ accountId: id(account._id), value: id(account.user) })),
  );
  const duplicateOfficerAssignments = groupDuplicates(
    accounts.map((account) => ({ accountId: id(account._id), value: id(account.officer) })),
  );
  const usersWithoutAccount = users
    .filter((user) => !accountsByUser.has(id(user._id)))
    .map((user) => ({
      userId: id(user._id),
      fullname: user.fullname,
      legacyRoleId: id(user.role),
      roles: (user.roles ?? []).map((roleId) => id(roleId)),
    }));

  const duplicateRoleNames = [
    ...roles
      .reduce((grouped, role) => {
        const name = normalize(role.name);
        grouped.set(name, [...(grouped.get(name) ?? []), id(role._id)]);
        return grouped;
      }, new Map<string, string[]>())
      .entries(),
  ]
    .filter(([, roleIds]) => roleIds.length > 1)
    .map(([name, roleIds]) => ({ name, roleIds }));
  const invalidRolePermissions = roles
    .map((role) => {
      const resources = (role.permissions ?? []).map(({ resource }) => resource);
      const duplicateResources = resources.filter((resource, index) => resources.indexOf(resource) !== index);
      const invalidPermissions = (role.permissions ?? []).filter(({ resource, actions }) => {
        const validActions = validActionsByResource.get(resource);
        const configuredActions = actions ?? [];
        return (
          !validActions ||
          configuredActions.length === 0 ||
          configuredActions.some((action) => !validActions.has(action))
        );
      });
      return duplicateResources.length || invalidPermissions.length
        ? { roleId: id(role._id), roleName: role.name, duplicateResources, invalidPermissions }
        : null;
    })
    .filter(Boolean);
  const unusedRoles = roles
    .filter((role) => !usedRoleIds.has(id(role._id)))
    .map((role) => ({ roleId: id(role._id), roleName: role.name }));
  const blockers = {
    missingReferences,
    duplicateUserAssignments,
    duplicateOfficerAssignments,
    uninterpretablePartialAccounts,
    accountsWithoutRole,
    accountRoleConflicts,
    duplicateRoleNames,
    usersWithConflictingRoleModels,
  };
  const blockerCount = Object.values(blockers).reduce((total, findings) => total + findings.length, 0);
  const report = {
    mode: dryRun ? 'dry-run' : 'apply',
    totals: { users: users.length, roles: roles.length, accounts: accounts.length, officers: officers.length },
    blockerCount,
    findingCounts: {
      legacyVacantAccounts: legacyVacantAccounts.length,
      usersWithoutAccount: usersWithoutAccount.length,
      fullnameMismatches: fullnameMismatches.length,
      invalidRolePermissions: invalidRolePermissions.length,
      unusedRoles: unusedRoles.length,
    },
    blockers,
    migrationPreview: {
      legacyVacantAccounts,
      usersWithoutAccount,
    },
    warnings: {
      fullnameMismatches,
      invalidRolePermissions,
      unusedRoles,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (blockerCount > 0) {
    process.exitCode = 2;
    if (!dryRun) throw new Error(`Migration stopped: ${blockerCount} blocking findings require manual review`);
    return;
  }
  if (dryRun) return;

  const accountRoleOperations = accounts.map((account) => {
    const user = account.user ? usersById.get(id(account.user)) : null;
    const role = account.role ?? user?.role;
    return {
      updateOne: {
        filter: { _id: account._id },
        update: { $set: { role } },
      },
    };
  });
  const userOperations = users.map((user) => {
    const hasLegacyRole = !!user.role;
    const hasAccount = accountsByUser.has(id(user._id));
    const shouldInitializeRoles = hasLegacyRole || !Array.isArray(user.roles);
    const roles = hasLegacyRole ? (hasAccount ? [] : [user.role]) : (user.roles ?? []);
    return {
      updateOne: {
        filter: { _id: user._id },
        update: {
          ...(shouldInitializeRoles ? { $set: { roles } } : {}),
          $unset: { role: '' as const },
        },
      },
    };
  });
  const vacancyOperations = accounts
    .filter((account) => {
      const user = account.user ? usersById.get(id(account.user)) : null;
      return !!user && !account.officer && isArtificialVacancy(user);
    })
    .map((account) => ({
      updateOne: {
        filter: { _id: account._id },
        update: { $set: { user: null, officer: null } },
      },
    }));

  const applyDataChanges = async (session?: ClientSession) => {
    const options = session ? { session } : undefined;
    if (accountRoleOperations.length) await accountsCollection.bulkWrite(accountRoleOperations, options);
    if (userOperations.length) await usersCollection.bulkWrite(userOperations, options);
    if (vacancyOperations.length) await accountsCollection.bulkWrite(vacancyOperations, options);
  };

  const hello = await db.admin().command({ hello: 1 });
  const supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
  if (supportsTransactions) {
    const session = await mongoose.connection.startSession();
    try {
      await session.withTransaction(() => applyDataChanges(session));
    } finally {
      await session.endSession();
    }
  } else {
    console.warn('MongoDB standalone detected: applying prevalidated idempotent bulk operations without a transaction.');
    await applyDataChanges();
  }

  await ensureUniqueIndex(
    accountsCollection,
    { user: 1 },
    'user_1',
    { user: { $type: 'objectId' } },
  );
  await ensureUniqueIndex(
    accountsCollection,
    { officer: 1 },
    'officer_1',
    { officer: { $type: 'objectId' } },
  );
  await ensureUniqueIndex(rolesCollection, { name: 1 }, 'name_1');
  console.log('Migration applied successfully. Account and Role unique indexes are active.');
}

async function ensureUniqueIndex<T extends mongoose.mongo.Document>(
  collection: mongoose.mongo.Collection<T>,
  key: Record<string, 1>,
  name: string,
  partialFilterExpression?: Record<string, object>,
) {
  const indexes = await collection.listIndexes().toArray();
  const matchingIndexes = indexes.filter((index) => JSON.stringify(index.key) === JSON.stringify(key));
  const expectedPartial = JSON.stringify(partialFilterExpression ?? null);
  const current = matchingIndexes.find(
    (index) => index.unique && JSON.stringify(index.partialFilterExpression ?? null) === expectedPartial,
  );
  if (current?.name === name) return;

  for (const index of matchingIndexes) {
    if (index.name && index.name !== '_id_') await collection.dropIndex(index.name);
  }
  await collection.createIndex(key, {
    name,
    unique: true,
    ...(partialFilterExpression && { partialFilterExpression }),
  });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

import { config } from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { SYSTEM_RESOURCES } from '../src/modules/auth/constants';

config();

type RoleContext = 'USER' | 'ACCOUNT';

interface LegacyRole {
  _id: Types.ObjectId;
  name: string;
  context?: RoleContext;
  permissions?: { resource: string; actions: string[] }[];
}

interface LegacyUser {
  _id: Types.ObjectId;
  fullname?: string;
  role?: Types.ObjectId;
  directRole?: Types.ObjectId;
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
const configuredAdminNames = (process.env.MIGRATION_ADMIN_ROLES ?? 'ADMIN,ADMINISTRADOR,ADMINISTRATOR')
  .split(',')
  .map(normalize)
  .filter(Boolean);
const adminRoleNames = new Set(configuredAdminNames);
const operationalResources = new Set(['external', 'internal', 'procurement']);
const administrativeResources = new Set([
  'institutions',
  'dependencies',
  'types-procedures',
  'officers',
  'accounts',
  'user',
  'roles',
  'groupware',
]);
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

function canonicalRoleName(value?: string) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function id(value?: Types.ObjectId | null) {
  return value ? value.toString() : null;
}

function groupDuplicates(values: { ownerId: string; value: string | null }[]) {
  const grouped = new Map<string, string[]>();
  for (const { ownerId, value } of values) {
    if (!value) continue;
    grouped.set(value, [...(grouped.get(value) ?? []), ownerId]);
  }
  return [...grouped.entries()]
    .filter(([, ownerIds]) => ownerIds.length > 1)
    .map(([value, ownerIds]) => ({ value, accountIds: ownerIds }));
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
  const halfAssignedAccounts: object[] = [];
  const legacyVacantAccounts: object[] = [];
  const fullnameMismatches: object[] = [];
  const accountsWithoutOperationalRole: object[] = [];

  for (const account of accounts) {
    const accountId = id(account._id);
    const userId = id(account.user);
    const officerId = id(account.officer);
    const accountRoleId = id(account.role);
    const user = userId ? usersById.get(userId) : null;
    const officer = officerId ? officersById.get(officerId) : null;

    if (userId && !user) missingReferences.push({ accountId, property: 'user', reference: userId });
    if (officerId && !officer) missingReferences.push({ accountId, property: 'officer', reference: officerId });
    if (accountRoleId && !rolesById.has(accountRoleId)) {
      missingReferences.push({ accountId, property: 'role', reference: accountRoleId });
    }

    if (Boolean(userId) !== Boolean(officerId)) {
      const artificialVacancy = user && !officerId && normalize(user.fullname) === 'SIN ASIGNAR';
      if (artificialVacancy) {
        legacyVacantAccounts.push({ accountId, userId, legacyRoleId: id(user.role) });
      } else {
        halfAssignedAccounts.push({ accountId, userId, officerId });
      }
    }

    if (user && officer) {
      const officerName = normalize([officer.nombre, officer.paterno, officer.materno].filter(Boolean).join(' '));
      if (normalize(user.fullname) !== officerName) {
        fullnameMismatches.push({ accountId, userId, officerId, userName: user.fullname, officerName });
      }
    }

    const candidateRoleId = accountRoleId ?? id(user?.role);
    if (!candidateRoleId || !rolesById.has(candidateRoleId)) {
      accountsWithoutOperationalRole.push({ accountId, accountRoleId, legacyUserRoleId: id(user?.role) });
    }
  }

  for (const user of users) {
    const directRoleId = id(user.directRole);
    const legacyRoleId = id(user.role);
    if (directRoleId && !rolesById.has(directRoleId)) {
      missingReferences.push({ userId: id(user._id), property: 'directRole', reference: directRoleId });
    }
    if (legacyRoleId && !rolesById.has(legacyRoleId)) {
      missingReferences.push({ userId: id(user._id), property: 'role', reference: legacyRoleId });
    }
  }

  const duplicateUserAssignments = groupDuplicates(
    accounts.map((account) => ({ ownerId: id(account._id), value: id(account.user) })),
  );
  const duplicateOfficerAssignments = groupDuplicates(
    accounts.map((account) => ({ ownerId: id(account._id), value: id(account.officer) })),
  );
  const usersWithoutAccount = users
    .filter((user) => !accountsByUser.has(id(user._id)))
    .map((user) => ({
      userId: id(user._id),
      fullname: user.fullname,
      legacyRoleId: id(user.role),
      directRoleId: id(user.directRole),
    }));

  const duplicateRoleNames = [
    ...roles
      .reduce((map, role) => {
        const name = normalize(role.name);
        map.set(name, [...(map.get(name) ?? []), id(role._id)]);
        return map;
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

  const inferredContexts = new Map<string, Set<RoleContext>>();
  const accountUsageByRole = new Map<string, string[]>();
  const userUsageByRole = new Map<string, string[]>();
  const infer = (roleId: string | null, context: RoleContext) => {
    if (!roleId || !rolesById.has(roleId)) return;
    inferredContexts.set(roleId, new Set([...(inferredContexts.get(roleId) ?? []), context]));
  };

  for (const role of roles) if (role.context) infer(id(role._id), role.context);
  for (const account of accounts) {
    const accountRoleId = id(account.role);
    const user = account.user ? usersById.get(id(account.user)) : null;
    const usedRoleId = accountRoleId ?? id(user?.role);
    infer(usedRoleId, 'ACCOUNT');
    if (usedRoleId) {
      accountUsageByRole.set(usedRoleId, [...(accountUsageByRole.get(usedRoleId) ?? []), id(account._id)]);
    }
  }
  for (const user of users) {
    const directRoleId = id(user.directRole);
    infer(directRoleId, 'USER');
    if (directRoleId) userUsageByRole.set(directRoleId, [...(userUsageByRole.get(directRoleId) ?? []), id(user._id)]);
    const legacyRole = user.role ? rolesById.get(id(user.role)) : null;
    if (legacyRole && adminRoleNames.has(normalize(legacyRole.name))) {
      const legacyRoleId = id(legacyRole._id);
      infer(legacyRoleId, 'USER');
      userUsageByRole.set(legacyRoleId, [...(userUsageByRole.get(legacyRoleId) ?? []), id(user._id)]);
    }
  }

  for (const role of roles) {
    const roleId = id(role._id);
    if (inferredContexts.has(roleId)) continue;
    const resources = new Set((role.permissions ?? []).map(({ resource }) => resource));
    const hasOperational = [...resources].some((resource) => operationalResources.has(resource));
    const hasAdministrative = [...resources].some((resource) => administrativeResources.has(resource));
    if (adminRoleNames.has(normalize(role.name)) || (hasAdministrative && !hasOperational)) infer(roleId, 'USER');
    else if (hasOperational && !hasAdministrative) infer(roleId, 'ACCOUNT');
  }

  const ambiguousRoleUsage = [...inferredContexts.entries()]
    .filter(([, contexts]) => contexts.size > 1)
    .map(([roleId, contexts]) => ({
      roleId,
      roleName: rolesById.get(roleId)?.name,
      contexts: [...contexts],
      accountIds: accountUsageByRole.get(roleId) ?? [],
      userIds: userUsageByRole.get(roleId) ?? [],
    }));
  const unclassifiedRoles = roles
    .filter((role) => !inferredContexts.has(id(role._id)))
    .map((role) => ({
      roleId: id(role._id),
      roleName: role.name,
      accountIds: accountUsageByRole.get(id(role._id)) ?? [],
      userIds: userUsageByRole.get(id(role._id)) ?? [],
    }));
  const contextConflicts = roles
    .filter(
      (role) =>
        role.context && inferredContexts.get(id(role._id)) && !inferredContexts.get(id(role._id)).has(role.context),
    )
    .map((role) => ({
      roleId: id(role._id),
      roleName: role.name,
      stored: role.context,
      inferred: [...inferredContexts.get(id(role._id))],
    }));
  const mixedPermissionRoles = roles
    .map((role) => {
      const resources = new Set((role.permissions ?? []).map(({ resource }) => resource));
      const hasOperational = [...resources].some((resource) => operationalResources.has(resource));
      const hasAdministrative = [...resources].some((resource) => administrativeResources.has(resource));
      return hasOperational && hasAdministrative
        ? {
            roleId: id(role._id),
            roleName: role.name,
            resources: [...resources],
            inferredContexts: [...(inferredContexts.get(id(role._id)) ?? [])],
          }
        : null;
    })
    .filter(Boolean);

  const report = {
    mode: dryRun ? 'dry-run' : 'apply',
    totals: { users: users.length, roles: roles.length, accounts: accounts.length, officers: officers.length },
    missingReferences,
    duplicateUserAssignments,
    duplicateOfficerAssignments,
    halfAssignedAccounts,
    legacyVacantAccounts,
    usersWithoutAccount,
    fullnameMismatches,
    accountsWithoutOperationalRole,
    duplicateRoleNames,
    invalidRolePermissions,
    ambiguousRoleUsage,
    contextConflicts,
    unclassifiedRoles,
    mixedPermissionRoles,
  };

  console.log(JSON.stringify(report, null, 2));

  const blockers = [
    ...missingReferences,
    ...duplicateUserAssignments,
    ...duplicateOfficerAssignments,
    ...halfAssignedAccounts,
    ...fullnameMismatches,
    ...accountsWithoutOperationalRole,
    ...duplicateRoleNames,
    ...invalidRolePermissions,
    ...ambiguousRoleUsage,
    ...contextConflicts,
    ...unclassifiedRoles,
  ];

  if (blockers.length > 0) {
    process.exitCode = 2;
    if (!dryRun) throw new Error(`Migration stopped: ${blockers.length} blocking findings require manual review`);
    return;
  }
  if (dryRun) return;

  const roleContext = new Map<string, RoleContext>(
    [...inferredContexts.entries()].map(([roleId, contexts]) => [roleId, [...contexts][0]]),
  );
  const session = await mongoose.connection.startSession();
  try {
    session.startTransaction();
    const roleOperations = roles.map((role) => ({
      updateOne: {
        filter: { _id: role._id },
        update: { $set: { name: canonicalRoleName(role.name), context: roleContext.get(id(role._id)) } },
      },
    }));
    const accountOperations = accounts.map((account) => {
      const user = account.user ? usersById.get(id(account.user)) : null;
      const roleId = account.role ?? user?.role;
      const isLegacyVacancy = user && !account.officer && normalize(user.fullname) === 'SIN ASIGNAR';
      return {
        updateOne: {
          filter: { _id: account._id },
          update: {
            $set: {
              role: roleId,
              ...(isLegacyVacancy ? { user: null, officer: null } : {}),
            },
          },
        },
      };
    });
    const userOperations = users
      .filter((user) => user.role)
      .map((user) => {
        const legacyRole = rolesById.get(id(user.role));
        const setDirectRole = legacyRole && roleContext.get(id(legacyRole._id)) === 'USER' && !user.directRole;
        return {
          updateOne: {
            filter: { _id: user._id },
            update: {
              ...(setDirectRole ? { $set: { directRole: user.role } } : {}),
              $unset: { role: '' },
            },
          },
        };
      });

    if (roleOperations.length) await rolesCollection.bulkWrite(roleOperations as any[], { session });
    if (accountOperations.length) await accountsCollection.bulkWrite(accountOperations as any[], { session });
    if (userOperations.length) await usersCollection.bulkWrite(userOperations as any[], { session });
    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }

  await accountsCollection.createIndex(
    { user: 1 },
    { name: 'user_1', unique: true, partialFilterExpression: { user: { $type: 'objectId' } } },
  );
  await accountsCollection.createIndex(
    { officer: 1 },
    { name: 'officer_1', unique: true, partialFilterExpression: { officer: { $type: 'objectId' } } },
  );
  await rolesCollection.createIndex({ name: 1 }, { name: 'name_1', unique: true });
  console.log('Migration applied successfully. Account and Role unique indexes are active.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

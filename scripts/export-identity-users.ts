import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { config } from 'dotenv';
import mongoose, { Types } from 'mongoose';

config();

interface LegacyUser {
  _id: Types.ObjectId;
  fullname?: unknown;
  login?: unknown;
  externalKey?: unknown;
  isActive?: unknown;
  roles?: Types.ObjectId[];
}

interface LegacyOfficer {
  _id: Types.ObjectId;
  dni?: unknown;
  email?: unknown;
}

interface LegacyAccount {
  _id: Types.ObjectId;
  user?: Types.ObjectId | null;
  officer?: Types.ObjectId | null;
}

interface Candidate {
  userId: string;
  login: string | null;
  fullName: string;
  relationKey: string;
  email: string | null;
}

interface Unresolved {
  accountId?: string;
  userId?: string;
  reason: string;
}

function id(value?: Types.ObjectId | null) {
  return value?.toString() ?? null;
}

function toOptionalString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  await mongoose.connect(databaseUrl, { autoIndex: false });
  const db = mongoose.connection.db;

  const [users, officers, accounts] = await Promise.all([
    db
      .collection<LegacyUser>('users')
      .find({}, { projection: { _id: 1, fullname: 1, login: 1, externalKey: 1, isActive: 1, roles: 1 } })
      .toArray(),
    db
      .collection<LegacyOfficer>('funcionarios')
      .find({}, { projection: { _id: 1, dni: 1, email: 1 } })
      .toArray(),
    db
      .collection<LegacyAccount>('cuentas')
      .find({}, { projection: { _id: 1, user: 1, officer: 1 } })
      .toArray(),
  ]);

  const officersById = new Map(officers.map((officer) => [id(officer._id), officer]));
  const accountsByUserId = new Map(
    accounts.flatMap((account) => {
      const userId = id(account.user);
      return userId ? [[userId, account] as const] : [];
    }),
  );
  const candidates: Candidate[] = [];
  const unresolved: Unresolved[] = [];

  for (const user of users) {
    if (user.isActive !== true || user.externalKey) continue;

    const userId = id(user._id);
    const account = accountsByUserId.get(userId);
    const hasDirectRoles = Array.isArray(user.roles) && user.roles.length > 0;

    if (!account) {
      if (userId && hasDirectRoles) {
        unresolved.push({ userId, reason: 'User sin Account con roles directos' });
      }
      continue;
    }

    const accountId = id(account._id);
    const officerId = id(account.officer);
    const officer = officersById.get(officerId);
    const fullName = toOptionalString(user.fullname);
    const relationKey = toOptionalString(officer?.dni);
    const reasons: string[] = [];

    if (!officerId) reasons.push('Account sin Officer');
    else if (!officer) reasons.push('Officer referenciado no existe');
    if (!fullName) reasons.push('User sin fullName');
    if (officer && !relationKey) reasons.push('Officer sin dni');

    if (reasons.length || !userId || !fullName || !relationKey) {
      unresolved.push({ ...(accountId && { accountId }), ...(userId && { userId }), reason: reasons.join('; ') });
      continue;
    }

    candidates.push({
      userId,
      login: toOptionalString(user.login),
      fullName,
      relationKey,
      email: toOptionalString(officer.email),
    });
  }

  candidates.sort((left, right) => left.userId.localeCompare(right.userId));
  unresolved.sort((left, right) =>
    (left.accountId ?? left.userId ?? '').localeCompare(right.accountId ?? right.userId ?? ''),
  );

  const outputPath = resolve(__dirname, '../migration-data/seguimiento-identity-users.json');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ candidates, unresolved }, null, 2)}\n`, 'utf8');
  console.log(`Identity migration data exported to ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

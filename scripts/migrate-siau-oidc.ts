import { config } from 'dotenv';
import mongoose from 'mongoose';

config();

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  await mongoose.connect(databaseUrl, { autoIndex: false });
  const db = mongoose.connection.db;
  const sessions = db.collection('auth_sessions');
  const transactions = db.collection('oauth_transactions');

  // Run with the backend stopped, before enabling the OIDC login.
  if (dryRun) {
    const [identityHubSessions, oauthTransactions] = await Promise.all([
      sessions.countDocuments({ authMethod: 'IDENTITY_HUB' }),
      transactions.countDocuments({}),
    ]);
    console.log(JSON.stringify({ mode: 'dry-run', identityHubSessions, oauthTransactions }, null, 2));
    return;
  }

  const removedSessions = await sessions.deleteMany({ authMethod: 'IDENTITY_HUB' });
  await sessions.updateMany(
    { authMethod: 'LOCAL' },
    {
      $unset: {
        accessToken: '',
        refreshToken: '',
        accessTokenExpiresAt: '',
        refreshTokenExpiresAt: '',
        refreshLock: '',
        refreshLockUntil: '',
        updatedAt: '',
      },
    },
  );
  const removedTransactions = await transactions.deleteMany({});
  console.log(
    JSON.stringify(
      {
        mode: 'apply',
        identityHubSessions: removedSessions.deletedCount,
        oauthTransactions: removedTransactions.deletedCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

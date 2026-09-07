import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Model } from 'mongoose';
import { OAuthTransaction } from '../schemas/oauth-transaction.schema';

const OAUTH_TRANSACTION_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class OAuthTransactionService {
  constructor(@InjectModel(OAuthTransaction.name) private readonly transactions: Model<OAuthTransaction>) {}

  async create() {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(64).toString('base64url');
    const transaction = await this.transactions.create({
      _id: randomBytes(32).toString('base64url'),
      stateHash: this.hash(state).toString('hex'),
      codeVerifier,
      expiresAt: new Date(Date.now() + OAUTH_TRANSACTION_TTL_MS),
    });
    return {
      transactionId: transaction._id,
      expiresAt: transaction.expiresAt,
      state,
      codeChallenge: createHash('sha256').update(codeVerifier).digest('base64url'),
    };
  }

  async consume(id: string, state: string): Promise<string | null> {
    // Atomic removal also consumes expired transactions and incorrect state attempts.
    const transaction = await this.transactions.findOneAndDelete({ _id: id }, { includeResultMetadata: false });
    if (!transaction || transaction.expiresAt.getTime() <= Date.now()) return null;
    return timingSafeEqual(Buffer.from(transaction.stateHash, 'hex'), this.hash(state))
      ? transaction.codeVerifier
      : null;
  }

  async discard(id?: string): Promise<void> {
    if (id) await this.transactions.deleteOne({ _id: id });
  }

  private hash(value: string): Buffer {
    return createHash('sha256').update(value).digest();
  }
}

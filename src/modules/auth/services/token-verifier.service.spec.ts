import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { TokenVerifierService } from './token-verifier.service';

const issuer = 'https://siau.example';
const clientId = 'seg-tramites';
const event = 'http://schemas.openid.net/event/backchannel-logout';

describe('TokenVerifierService', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const verifier = new TokenVerifierService({
    get: () => undefined,
    getOrThrow: (key: string) =>
      ({
        IDENTITY_HUB_PUBLIC_URL: issuer,
        OAUTH_CLIENT_ID: clientId,
      }[key]),
  } as any);

  beforeAll(() => {
    jest.spyOn((verifier as any).jwks, 'getSigningKey').mockResolvedValue({
      getPublicKey: () => publicKey.export({ type: 'spki', format: 'pem' }),
    });
  });

  const sign = (claims: Record<string, unknown>, typ = 'logout+jwt') =>
    jwt.sign(
      {
        iss: issuer,
        aud: clientId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        ...claims,
      },
      privateKey,
      { algorithm: 'RS256', keyid: 'test-key', header: { alg: 'RS256', typ } },
    );

  it('requires sid in access tokens', async () => {
    await expect(
      verifier.verify(sign({ sub: 'user', externalKey: 'external', sid: 'siau-session' }, 'JWT')),
    ).resolves.toMatchObject({ sid: 'siau-session' });
    await expect(verifier.verify(sign({ sub: 'user', externalKey: 'external' }, 'JWT'))).rejects.toThrow();
  });

  it('accepts a valid back-channel token and rejects invalid claims', async () => {
    const claims = { jti: 'logout-1', sid: 'siau-session', events: { [event]: {} } };
    await expect(verifier.verifyLogoutToken(sign(claims))).resolves.toBe('siau-session');
    await expect(verifier.verifyLogoutToken(sign(claims, 'JWT'))).rejects.toThrow();
    await expect(verifier.verifyLogoutToken(sign({ ...claims, nonce: 'unexpected' }))).rejects.toThrow();
    await expect(verifier.verifyLogoutToken(sign({ ...claims, aud: ['seg-tramites'] }))).rejects.toThrow();
    await expect(verifier.verifyLogoutToken(sign({ ...claims, sid: undefined }))).rejects.toThrow();
    await expect(verifier.verifyLogoutToken(sign({ ...claims, events: { [event]: true } }))).rejects.toThrow();
  });
});

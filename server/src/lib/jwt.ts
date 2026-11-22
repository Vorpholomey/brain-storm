import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'fallback-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'fallback-refresh-secret';

export function generateAccessToken(payload: { userId: string }): string {
  return jwt.sign(
    { userId: payload.userId },
    ACCESS_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    } as jwt.SignOptions,
  );
}

export function generateRefreshToken(payload: { userId: string }): string {
  return jwt.sign(
    { userId: payload.userId },
    REFRESH_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): { userId: string } {
  return jwt.verify(token, ACCESS_SECRET, { algorithms: ['HS256'] }) as {
    userId: string;
  };
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, REFRESH_SECRET, { algorithms: ['HS256'] }) as {
    userId: string;
  };
}

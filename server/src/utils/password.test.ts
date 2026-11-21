import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../utils/password';

describe('hashPassword', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('mySecurePassword123');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('mySecurePassword123');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should produce different hashes for the same password (salt)', async () => {
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce bcrypt hash format', async () => {
    const hash = await hashPassword('test');
    expect(hash).toMatch(/^\$2[aby]\$\d+\$.{53}$/);
  });
});

describe('comparePassword', () => {
  it('should return true for correct password', async () => {
    const hash = await hashPassword('correctPassword');
    const result = await comparePassword('correctPassword', hash);
    expect(result).toBe(true);
  });

  it('should return false for wrong password', async () => {
    const hash = await hashPassword('correctPassword');
    const result = await comparePassword('wrongPassword', hash);
    expect(result).toBe(false);
  });

  it('should return false for empty password', async () => {
    const hash = await hashPassword('correctPassword');
    const result = await comparePassword('', hash);
    expect(result).toBe(false);
  });

  it('should return false for plain text comparison', async () => {
    const result = await comparePassword('password', 'not-a-hash');
    expect(result).toBe(false);
  });
});

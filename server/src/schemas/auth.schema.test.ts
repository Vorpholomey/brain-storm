import { describe, it, expect } from 'vitest';
import { RegisterSchema, LoginSchema } from '../schemas/auth.schema';

describe('RegisterSchema', () => {
  it('should validate correct registration data', () => {
    const result = RegisterSchema.parse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('password123');
  });

  it('should reject invalid email', () => {
    expect(() =>
      RegisterSchema.parse({ email: 'not-an-email', password: 'password123' })
    ).toThrow();
  });

  it('should reject password shorter than 8 characters', () => {
    expect(() =>
      RegisterSchema.parse({ email: 'test@example.com', password: 'short' })
    ).toThrow();
  });

  it('should accept password with exactly 8 characters', () => {
    const result = RegisterSchema.parse({
      email: 'test@example.com',
      password: '12345678',
    });
    expect(result.password).toBe('12345678');
  });

  it('should reject password longer than 128 characters', () => {
    const longPassword = 'a'.repeat(129);
    expect(() =>
      RegisterSchema.parse({ email: 'test@example.com', password: longPassword })
    ).toThrow();
  });

  it('should reject missing email', () => {
    expect(() => RegisterSchema.parse({ password: 'password123' })).toThrow();
  });

  it('should reject missing password', () => {
    expect(() => RegisterSchema.parse({ email: 'test@example.com' })).toThrow();
  });
});

describe('LoginSchema', () => {
  it('should validate correct login data', () => {
    const result = LoginSchema.parse({
      email: 'test@example.com',
      password: 'any',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('any');
  });

  it('should reject invalid email', () => {
    expect(() =>
      LoginSchema.parse({ email: 'not-an-email', password: 'pass' })
    ).toThrow();
  });

  it('should reject empty password', () => {
    expect(() =>
      LoginSchema.parse({ email: 'test@example.com', password: '' })
    ).toThrow();
  });

  it('should reject missing fields', () => {
    expect(() => LoginSchema.parse({})).toThrow();
  });
});

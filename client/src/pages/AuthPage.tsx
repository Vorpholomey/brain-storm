import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import styles from './AuthPage.module.css';

type Tab = 'login' | 'register';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';
  const { login, register } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!EMAIL_REGEX.test(email)) {
      newErrors.email = 'Введите корректный email';
    }
    if (password.length < 8) {
      newErrors.password = 'Пароль должен содержать минимум 8 символов';
    }
    if (tab === 'register') {
      if (password !== passwordConfirm) {
        newErrors.passwordConfirm = 'Пароли не совпадают';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (!validate()) return;

    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name || undefined);
      }
      navigate(redirectUrl, { replace: true });
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      setGeneralError(error.message || 'Произошла ошибка. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const activeTabClass = styles.auth__tab + ' ' + styles['auth__tab--active'];

  return (
    <div className={styles.auth}>
      <div className={styles.auth__card}>
        <Card>
          <h2 className={styles.auth__title}>
            {tab === 'login' ? 'Вход в систему' : 'Регистрация'}
          </h2>

          <div className={styles.auth__tabs}>
            <button
              type="button"
              className={tab === 'login' ? activeTabClass : styles.auth__tab}
              onClick={() => {
                setTab('login');
                setErrors({});
                setGeneralError('');
              }}
            >
              Вход
            </button>
            <button
              type="button"
              className={tab === 'register' ? activeTabClass : styles.auth__tab}
              onClick={() => {
                setTab('register');
                setErrors({});
                setGeneralError('');
              }}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.auth__form}>
            {generalError && <div className={styles.auth__error}>{generalError}</div>}

            <Input
              id="auth-email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              disabled={loading}
            />

            <Input
              id="auth-password"
              name="password"
              type="password"
              label="Пароль"
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={loading}
            />

            {tab === 'register' && (
              <>
                <Input
                  id="auth-name"
                  name="name"
                  type="text"
                  label="Имя (необязательно)"
                  placeholder="Ваше имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />

                <Input
                  id="auth-password-confirm"
                  name="passwordConfirm"
                  type="password"
                  label="Подтвердите пароль"
                  placeholder="Повторите пароль"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  error={errors.passwordConfirm}
                  disabled={loading}
                />
              </>
            )}

            <Button type="submit" fullWidth loading={loading}>
              {tab === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

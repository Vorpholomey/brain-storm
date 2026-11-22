import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { Lightbulb, Users, Sparkles } from 'lucide-react';
import styles from './LandingPage.module.css';

const features = [
  {
    icon: Lightbulb,
    title: 'Структурированный процесс',
    text: 'Проверенные методологии мозгового штурма: от генерации идей до финального выбора решения.',
  },
  {
    icon: Users,
    title: 'Командная работа',
    text: 'Синхронная работа в реальном времени: обсуждайте, голосуйте, принимайте решения вместе.',
  },
  {
    icon: Sparkles,
    title: 'AI-помощник',
    text: 'Искусственный интеллект помогает генерировать идеи, структурировать мысли и находить лучшие решения.',
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCreateSession = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.hero__title}>
          Мозговой штурм, который заканчивается решением
        </h1>
        <p className={styles.hero__subtitle}>
          Структурированная платформа для командного творчества: генерируйте идеи,
          голосуйте, обсуждайте и приходите к лучшим решениям вместе.
        </p>
        <Button size="lg" onClick={handleCreateSession}>
          Создать сессию
        </Button>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <h2 className={styles.features__title}>Почему Brain Storm?</h2>
        <div className={styles.features__grid}>
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title}>
                <div className={styles.feature__icon}>
                  <Icon size={28} />
                </div>
                <h3 className={styles.feature__title}>{item.title}</h3>
                <p className={styles.feature__text}>{item.text}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <p className="text-slate-500 mb-4">Готовы начать?</p>
        <Button size="lg" onClick={handleCreateSession}>
          Создать сессию
        </Button>
      </section>
    </div>
  );
};

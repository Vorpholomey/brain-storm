import { useState } from 'react';
import { SessionContainer } from './pages/SessionContainer';

function App() {
  const [sessionId, setSessionId] = useState('');
  const [token, setToken] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionId.trim() && token.trim()) {
      setJoined(true);
    }
  };

  if (joined) {
    return (
      <SessionContainer
        sessionId={sessionId.trim()}
        token={token.trim()}
        voteLimit={10}
      />
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ color: '#1e293b' }}>Brain Storm</h1>

      <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label
            htmlFor="sessionId"
            style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: '#334155' }}
          >
            ID сессии
          </label>
          <input
            id="sessionId"
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Введите ID сессии"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="token"
            style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: '#334155' }}
          >
            Токен авторизации
          </label>
          <input
            id="token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Введите JWT токен"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            background: '#3b82f6',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 500,
          }}
        >
          Присоединиться к сессии
        </button>
      </form>
    </div>
  );
}

export default App;

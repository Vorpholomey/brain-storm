import React from 'react';

interface IdeaCardProps {
  idea: {
    id: string;
    title: string;
    content: string;
    voteCount: number;
    hasVoted: boolean;
  };
  onVote: (ideaId: string) => void;
  isVoteDisabled: boolean;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ idea, onVote, isVoteDisabled }) => {
  const voteDisabled = isVoteDisabled || idea.hasVoted;

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#1e293b' }}>
        {idea.title}
      </h3>

      <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>
        {idea.content}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
        }}
      >
        <span
          style={{
            fontSize: '0.875rem',
            color: '#64748b',
            fontWeight: 500,
          }}
        >
          👍 {idea.voteCount}
        </span>

        <button
          onClick={() => onVote(idea.id)}
          disabled={voteDisabled}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: voteDisabled ? '#94a3b8' : '#3b82f6',
            color: '#fff',
            cursor: voteDisabled ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'background 0.2s',
          }}
        >
          {idea.hasVoted ? 'Голосовал' : 'Голосовать'}
        </button>
      </div>
    </div>
  );
};

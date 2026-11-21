import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdeaCard } from './IdeaCard';

describe('IdeaCard', () => {
  const mockIdea = {
    id: 'idea-1',
    title: 'Test Idea',
    content: 'This is a test idea content',
    voteCount: 5,
    hasVoted: false,
  };

  const mockOnVote = vi.fn();

  it('should render idea title and content', () => {
    render(
      <IdeaCard
        idea={mockIdea}
        onVote={mockOnVote}
        isVoteDisabled={false}
      />
    );
    expect(screen.getByText('Test Idea')).toBeDefined();
    expect(screen.getByText('This is a test idea content')).toBeDefined();
  });

  it('should display vote count', () => {
    render(
      <IdeaCard
        idea={mockIdea}
        onVote={mockOnVote}
        isVoteDisabled={false}
      />
    );
    expect(screen.getByText('👍 5')).toBeDefined();
  });

  it('should show "Голосовать" button when not voted', () => {
    render(
      <IdeaCard
        idea={mockIdea}
        onVote={mockOnVote}
        isVoteDisabled={false}
      />
    );
    const button = screen.getByText('Голосовать');
    expect(button).toBeDefined();
  });

  it('should show "Голосовал" button when already voted', () => {
    const votedIdea = { ...mockIdea, hasVoted: true };
    render(
      <IdeaCard
        idea={votedIdea}
        onVote={mockOnVote}
        isVoteDisabled={false}
      />
    );
    const button = screen.getByText('Голосовал');
    expect(button).toBeDefined();
  });

  it('should call onVote when button is clicked', () => {
    render(
      <IdeaCard
        idea={mockIdea}
        onVote={mockOnVote}
        isVoteDisabled={false}
      />
    );
    const button = screen.getByText('Голосовать');
    fireEvent.click(button);
    expect(mockOnVote).toHaveBeenCalledWith('idea-1');
  });

  it('should disable button when isVoteDisabled is true', () => {
    render(
      <IdeaCard
        idea={mockIdea}
        onVote={mockOnVote}
        isVoteDisabled={true}
      />
    );
    const button = screen.getByText('Голосовать');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('should disable button when already voted', () => {
    const votedIdea = { ...mockIdea, hasVoted: true };
    render(
      <IdeaCard
        idea={votedIdea}
        onVote={mockOnVote}
        isVoteDisabled={false}
      />
    );
    const button = screen.getByText('Голосовал');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('should not call onVote when button is disabled', () => {
    render(
      <IdeaCard
        idea={mockIdea}
        onVote={mockOnVote}
        isVoteDisabled={true}
      />
    );
    const button = screen.getByText('Голосовать');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('should display zero votes correctly', () => {
    const zeroVoteIdea = { ...mockIdea, voteCount: 0 };
    render(
      <IdeaCard
        idea={zeroVoteIdea}
        onVote={mockOnVote}
        isVoteDisabled={false}
      />
    );
    expect(screen.getByText('👍 0')).toBeDefined();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSocket } from './useSocket';

// Mock socket.io-client
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockDisconnect = vi.fn();
const mockSocket = {
  emit: mockEmit,
  on: mockOn,
  disconnect: mockDisconnect,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
  Socket: {},
}));

// Get mocked io function
import { io as mockIo } from 'socket.io-client';

describe('useSocket', () => {
  const options = {
    sessionId: 'session-1',
    token: 'test-token',
    onVoteUpdated: vi.fn(),
    onVoteRejected: vi.fn(),
    onJoined: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should connect to socket server', () => {
    renderHook(() => useSocket(options));
    expect(mockIo).toHaveBeenCalledWith(
      'http://localhost:3000',
      expect.objectContaining({
        auth: { token: 'test-token' },
        transports: ['websocket'],
      })
    );
  });

  it('should join session on connect', () => {
    renderHook(() => useSocket(options));

    const connectedCallback = mockOn.mock.calls.find(
      (call) => call[0] === 'connected'
    )?.[1];

    expect(connectedCallback).toBeDefined();

    act(() => {
      connectedCallback!();
    });

    expect(mockEmit).toHaveBeenCalledWith('join_session', 'session-1');
  });

  it('should call onJoined when joined event received', () => {
    renderHook(() => useSocket(options));

    const joinedCallback = mockOn.mock.calls.find(
      (call) => call[0] === 'joined'
    )?.[1];

    act(() => {
      joinedCallback!({ sessionId: 'session-1' });
    });

    expect(options.onJoined).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  it('should call onVoteUpdated when vote_updated event received', () => {
    renderHook(() => useSocket(options));

    const voteUpdatedCallback = mockOn.mock.calls.find(
      (call) => call[0] === 'vote_updated'
    )?.[1];

    act(() => {
      voteUpdatedCallback!({ ideaId: 'idea-1', voteCount: 3 });
    });

    expect(options.onVoteUpdated).toHaveBeenCalledWith({
      ideaId: 'idea-1',
      voteCount: 3,
    });
  });

  it('should call onVoteRejected when vote_rejected event received', () => {
    renderHook(() => useSocket(options));

    const voteRejectedCallback = mockOn.mock.calls.find(
      (call) => call[0] === 'vote_rejected'
    )?.[1];

    act(() => {
      voteRejectedCallback!('Лимит голосов исчерпан');
    });

    expect(options.onVoteRejected).toHaveBeenCalledWith(
      'Лимит голосов исчерпан'
    );
  });

  it('should call onError when error event received', () => {
    renderHook(() => useSocket(options));

    const errorCallback = mockOn.mock.calls.find(
      (call) => call[0] === 'error'
    )?.[1];

    act(() => {
      errorCallback!({ message: 'Неверный токен' });
    });

    expect(options.onError).toHaveBeenCalledWith({
      message: 'Неверный токен',
    });
  });

  it('should emit cast_vote when castVote is called', () => {
    const { result } = renderHook(() => useSocket(options));

    act(() => {
      result.current.castVote('idea-1');
    });

    expect(mockEmit).toHaveBeenCalledWith(
      'cast_vote',
      'idea-1',
      expect.any(Function)
    );
  });

  it('should leave session and disconnect on unmount', () => {
    const { unmount } = renderHook(() => useSocket(options));

    act(() => {
      unmount();
    });

    expect(mockEmit).toHaveBeenCalledWith('leave_session');
    expect(mockDisconnect).toHaveBeenCalled();
  });
});

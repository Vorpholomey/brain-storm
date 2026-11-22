import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSessionSocket } from '@/hooks/useSessionSocket';
import { useServerTimer } from '@/hooks/useServerTimer';
import { useAuth } from '@/context/AuthContext';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import type {
  SessionStage,
  SessionMember,
  VoteUpdatedPayload,
  VoteRejectedPayload,
} from '@/types';
import { Wifi, WifiOff, X, PanelRightOpen, PanelRightClose, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { RoomHeader } from '../components/room/RoomHeader';
import { StageContent } from '../components/room/StageContent';
import { VotesPanel } from '../components/room/VotesPanel';
import { NotesPanel } from '../components/room/NotesPanel';
import { LeadersPanel, type LeaderIdea } from '../components/room/LeadersPanel';
import type { CommentItem } from '../components/room/CommentsThread';
import { CollectFromChatModal } from '../components/room/CollectFromChatModal';
import { addCommentToIdea, selectIdea } from '../api/ideas';
import styles from './SessionRoom.module.css';

// ---------------------------------------------------------------------------
// SessionRoom
// ---------------------------------------------------------------------------

export interface SessionRoomProps {
  sessionId: string;
}

export function SessionRoom({ sessionId }: SessionRoomProps): JSX.Element {
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  const {
    isConnected,
    onlineUsers,
    currentStage,
    stageDeadline,
    serverOffset,
    sessionState,
    send,
    leaveSession,
    on,
  } = useSessionSocket();

  const { formatted, isExpired } = useServerTimer(stageDeadline, serverOffset);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatModalOpen, setChatModalOpen] = useState(false);

  // Ref for scrolling to idea cards
  const ideaFeedRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Votes cache: ideaId -> { count, userIds }
  // -----------------------------------------------------------------------

  const [ideaVotes, setIdeaVotes] = useState<
    Record<string, { count: number; userIds: string[] }>
  >({});

  // Sync from sessionState on load / ideas list change
  useEffect(() => {
    if (!sessionState?.ideas) return;
    const votesMap: Record<string, { count: number; userIds: string[] }> = {};
    for (const idea of sessionState.ideas) {
      const votes = idea.votes ?? [];
      votesMap[idea.id] = {
        count: votes.length,
        userIds: votes.map((v) => v.userId),
      };
    }
    setIdeaVotes(votesMap);
  }, [sessionState?.ideas]);

  // Remaining votes calculation
  const voteLimit = sessionState?.config?.voteLimit ?? 0;
  const remainingVotes = useMemo(() => {
    if (!voteLimit) return 0;
    const used = Object.values(ideaVotes).reduce(
      (sum, v) => sum + (v.userIds.includes(currentUserId) ? 1 : 0),
      0,
    );
    return Math.max(0, voteLimit - used);
  }, [ideaVotes, currentUserId, voteLimit]);

  // -----------------------------------------------------------------------
  // Comments cache: ideaId -> CommentItem[]
  // -----------------------------------------------------------------------

  const [ideaComments, setIdeaComments] = useState<
    Record<string, CommentItem[]>
  >({});

  // Sync comments from sessionState ideas (if comments are included)
  useEffect(() => {
    if (!sessionState?.ideas) return;
    const commentsMap: Record<string, CommentItem[]> = {};
    for (const idea of sessionState.ideas) {
      // Comments may come from the API if included in the Idea type
      // For now, initialize empty — they will be populated on demand
      if (!commentsMap[idea.id]) {
        commentsMap[idea.id] = [];
      }
    }
    setIdeaComments(commentsMap);
  }, [sessionState?.ideas]);

  // -----------------------------------------------------------------------
  // WebSocket event subscriptions
  // -----------------------------------------------------------------------

  // vote_updated: server broadcasts new vote count for an idea
  useEffect(() => {
    return on('vote_updated', (payload: unknown) => {
      const p = payload as VoteUpdatedPayload;
      setIdeaVotes((map) => ({
        ...map,
        [p.ideaId]: {
          count: p.votesCount,
          userIds: map[p.ideaId]?.userIds ?? [],
        },
      }));
    });
  }, [on]);

  // vote_rejected: server rejects the vote
  useEffect(() => {
    return on('vote_rejected', (payload: unknown) => {
      const p = payload as VoteRejectedPayload;
      showToast(p.message ?? 'Голос отклонён', 'error');
      // Откат оптимистического голоса
      setIdeaVotes((map) => {
        for (const [ideaId, data] of Object.entries(map)) {
          if (data.userIds.includes(currentUserId)) {
            return {
              ...map,
              [ideaId]: {
                count: Math.max(0, data.count - 1),
                userIds: data.userIds.filter((id) => id !== currentUserId),
              },
            };
          }
        }
        return map;
      });
    });
  }, [on, currentUserId]);

  // -----------------------------------------------------------------------
  // Optimistic vote mutation
  // -----------------------------------------------------------------------

  const voteMutation = useOptimisticMutation();

  const handleVote = useCallback(
    async (ideaId: string) => {
      // Capture previous state for rollback
      const snapshot = { ...ideaVotes };
      const prev = snapshot[ideaId] ?? { count: 0, userIds: [] };

      // 1. Optimistically update UI
      setIdeaVotes((map) => ({
        ...map,
        [ideaId]: {
          count: prev.count + 1,
          userIds: [...prev.userIds, currentUserId],
        },
      }));

      // 2. Send vote via WebSocket
      send('cast_vote', { ideaId });

      // 3. Wrap in mutation for rollback on error
      // The mutation resolves after a short grace period; if vote_rejected
      // fires during that window, the rollback handler above will fire.
      await voteMutation.execute(
        () =>
          new Promise<void>((resolve) => {
            // Resolve after a short delay to allow server response
            setTimeout(resolve, 800);
          }),
        {
          rollback: () => {
            setIdeaVotes(() => snapshot);
          },
          onError: (message: string) => {
            showToast(message, 'error');
          },
        },
      );
    },
    [currentUserId, ideaVotes, send, voteMutation],
  );

  // -----------------------------------------------------------------------
  // Add idea
  // -----------------------------------------------------------------------

  const ideaMutation = useOptimisticMutation();

  const handlePublishIdea = useCallback(
    async (title: string, content: string) => {
      await ideaMutation.execute(
        async () => {
          const resp = await fetch('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              sessionId,
              title,
              content,
            }),
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({
              message: 'Ошибка создания идеи',
            }));
            throw new Error(err.message ?? 'Ошибка создания идеи');
          }
        },
        {
          onError: (message: string) => {
            showToast(message, 'error');
          },
        },
      );
      showToast('Идея добавлена!', 'success');
    },
    [sessionId, ideaMutation],
  );

  // -----------------------------------------------------------------------
  // Stage change (organizer only)
  // -----------------------------------------------------------------------

  const isOrganizer = sessionState?.members?.some(
    (m: SessionMember) => m.userId === currentUserId && m.role === 'ORGANIZER',
  ) ?? false;

  const handleStageChange = useCallback(
    async (newStage: SessionStage) => {
      send('stage_changed', { currentStage: newStage });
    },
    [send],
  );

  // -----------------------------------------------------------------------
  // Comments
  // -----------------------------------------------------------------------

  const handleAddComment = useCallback(
    async (ideaId: string, text: string) => {
      const comment = await addCommentToIdea(ideaId, text);
      setIdeaComments((prev) => ({
        ...prev,
        [ideaId]: [
          ...(prev[ideaId] ?? []),
          {
            id: comment.id,
            text: comment.text,
            createdAt: comment.createdAt,
            authorName: 'Вы',
          },
        ],
      }));
    },
    [user],
  );

  // -----------------------------------------------------------------------
  // Scroll to idea
  // -----------------------------------------------------------------------

  const scrollToIdea = useCallback((ideaId: string) => {
    const element = document.getElementById(`idea-card-${ideaId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Briefly highlight the card
      element.classList.add('ring-2', 'ring-primary');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary');
      }, 2000);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Toast helper
  // -----------------------------------------------------------------------

  function showToast(message: string, type: 'success' | 'error') {
    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-success' : 'bg-danger';
    toast.className = `fixed bottom-4 right-4 z-50 ${bgClass} text-white text-sm px-4 py-2 rounded-md shadow-card`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // -----------------------------------------------------------------------
  // Close drawer on Escape
  // -----------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) setDrawerOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const members: SessionMember[] = sessionState?.members ?? [];
  const topic = sessionState?.topic ?? 'Загрузка…';
  const onlineCount = onlineUsers.length;
  const ideas = sessionState?.ideas ?? [];
  const stage = currentStage ?? 'DISCUSSION';
  const mode = sessionState?.mode;
  const isPersonal = mode === 'PERSONAL';
  const selectedIdeaId = sessionState?.selectedIdeaId ?? null;

  // Leaders data (top ideas by votes) — после ideas
  const leaderIdeas: LeaderIdea[] = useMemo(() => {
    return ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      votesCount: ideaVotes[idea.id]?.count ?? 0,
      authorName: idea.author?.email ?? 'Аноним',
    }));
  }, [ideas, ideaVotes]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // Select idea (PERSONAL mode)
  // -----------------------------------------------------------------------

  const handleSelectIdea = useCallback(
    async (ideaId: string) => {
      try {
        await selectIdea(ideaId);
        showToast('Идея выбрана!', 'success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Ошибка выбора идеи';
        showToast(message, 'error');
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col overflow-x-hidden">
      {/* ===== Sticky Header ===== */}
      <RoomHeader
        topic={topic}
        currentStage={stage}
        stageDeadline={stageDeadline}
        serverOffset={serverOffset}
        onlineUsers={onlineUsers}
        isOrganizer={isOrganizer}
        mode={mode}
        onStageChange={isOrganizer ? handleStageChange : undefined}
      />

      {/* ===== Main Content with Sidebar ===== */}
      <div className="flex-1 flex">
        {/* Main area */}
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 lg:px-6" role="main">
          {/* Live region for counters (ideas, votes, online) */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            Идей: {ideas.length}, Осталось голосов: {remainingVotes}, Онлайн: {onlineCount}
          </div>
          <div ref={ideaFeedRef}>
            <StageContent
              sessionId={sessionId}
              currentStage={stage}
              ideas={ideas}
              currentUserId={currentUserId}
              isOrganizer={isOrganizer}
              onAddIdea={handlePublishIdea}
              onVote={handleVote}
              votes={ideaVotes}
              voteLimit={voteLimit}
              ideaComments={ideaComments}
              onAddComment={handleAddComment}
              mode={mode}
              selectedIdeaId={selectedIdeaId}
              onSelectIdea={handleSelectIdea}
            />
          </div>
        </main>

        {/* ===== Desktop Sidebar Toggle ===== */}
        <button
          type="button"
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 items-center gap-1 px-1.5 py-2 bg-white border border-r-0 border-neutral-200 rounded-l-md shadow-sm text-neutral-500 hover:text-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={sidebarOpen ? 'Скрыть панель' : 'Показать панель'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>

        {/* ===== Right Sidebar (Desktop) ===== */}
        <aside
          className={`hidden lg:flex flex-col gap-4 w-72 xl:w-80 fixed right-0 top-[64px] bottom-0 z-20 bg-white border-l border-neutral-200 p-4 overflow-y-auto transition-all duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
          }`}
          style={{ top: '5rem' }}
          aria-label="Боковая панель"
        >
          {/* Votes Panel (standard modes) / Notes Panel (PERSONAL mode) */}
          {isPersonal ? (
            <NotesPanel sessionId={sessionId} />
          ) : (
            <VotesPanel
              votesRemaining={remainingVotes}
              votesTotal={voteLimit}
            />
          )}

          {/* Leaders Panel — скрыт в PERSONAL режиме */}
          {!isPersonal && (
            <LeadersPanel
              ideas={leaderIdeas}
              onIdeaClick={scrollToIdea}
            />
          )}

          {/* Collect from Chat button — скрыт в PERSONAL режиме */}
          {!isPersonal && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setChatModalOpen(true)}
              className="gap-2"
              aria-label="Добавить идеи из чата"
            >
              <MessageSquare size={16} />
              Из чата
            </Button>
          )}
        </aside>
      </div>

      {/* ===== Connection Status — скрыт в PERSONAL режиме ===== */}
      {!isPersonal && (
        <div
          className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 text-xs text-neutral-500"
          aria-live="polite"
          aria-atomic="true"
        >
          {isConnected ? (
            <Wifi size={14} className="text-success" aria-hidden="true" />
          ) : (
            <WifiOff size={14} className="text-neutral-400" aria-hidden="true" />
          )}
          <span>{isConnected ? 'Подключено' : 'Отключено'}</span>
          <span className="text-neutral-400" aria-hidden="true">·</span>
          <span>{onlineCount} онлайн</span>
          {isExpired && (
            <>
              <span className="text-neutral-400" aria-hidden="true">·</span>
              <span className="text-danger">Этап завершён</span>
            </>
          )}
        </div>
      )}

      {/* ===== Mobile Bottom Bar — скрыт в PERSONAL режиме ===== */}
      {!isPersonal && (
        <nav className={styles.bottomBar} aria-label="Мобильная навигация">
          <button
            className={styles.bottomBarButton}
            onClick={() => setDrawerOpen(true)}
            aria-label="Открыть панель участников"
            aria-haspopup="dialog"
          >
            <X size={20} aria-hidden="true" />
            Участники
          </button>
        </nav>
      )}

      {/* ===== Drawer Overlay — скрыт в PERSONAL режиме ===== */}
      {!isPersonal && (
        <div
          className={`${styles.drawerOverlay} ${drawerOpen ? styles.drawerOverlayOpen : ''}`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ===== Drawer Panel — скрыт в PERSONAL режиме ===== */}
      {!isPersonal && (
        <div
          className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
        >
          <button
            className={styles.drawerClose}
            onClick={() => setDrawerOpen(false)}
            aria-label="Закрыть панель участников"
          >
            <X size={20} aria-hidden="true" />
          </button>

          <h2 id="drawer-title" className={styles.panelTitle}>Участники</h2>
          <ul className={styles.membersList}>
            {members.map((m) => {
              const isOnline = onlineUsers.includes(m.userId);
              return (
                <li key={m.id} className={styles.memberItem}>
                  <div className={styles.memberAvatar}>
                    {(m.user?.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className={styles.memberName}>
                    <div>{m.user?.email ?? 'Unknown'}</div>
                    <div className={styles.memberRole}>{m.role}</div>
                  </div>
                  {isOnline && (
                    <span
                      className={styles.onlineDot}
                      aria-label="Онлайн"
                      title="Онлайн"
                    />
                  )}
                </li>
              );
            })}
            {members.length === 0 && (
              <li className={styles.placeholder}>Нет участников</li>
            )}
          </ul>

          <div
            className={styles.statusInfo}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Этап</span>
              <span className={styles.statusValue}>{stage}</span>
            </div>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Время</span>
              <span className={styles.statusValue}>{formatted}</span>
            </div>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Онлайн</span>
              <span className={styles.statusValue}>{onlineCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== Collect From Chat Modal ===== */}
      <CollectFromChatModal
        isOpen={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        sessionId={sessionId}
        onIdeasAdded={() => {}}
      />
    </div>
  );
}

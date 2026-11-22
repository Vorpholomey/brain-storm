import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, StickyNote } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

// ——— Types ———

interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
}

interface NotesPanelProps {
  sessionId: string;
}

// ——— Helpers ———

function storageKey(sessionId: string): string {
  return `storm-notes-${sessionId}`;
}

function loadNotes(sessionId: string): NoteItem[] {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NoteItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotes(sessionId: string, notes: NoteItem[]) {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(notes));
  } catch {
    // Quota exceeded — silently ignore
  }
}

// ——— Component ———

export const NotesPanel: React.FC<NotesPanelProps> = ({ sessionId }) => {
  const [notes, setNotes] = useState<NoteItem[]>(() => loadNotes(sessionId));
  const [inputValue, setInputValue] = useState('');

  // Sync on every change
  useEffect(() => {
    saveNotes(sessionId, notes);
  }, [sessionId, notes]);

  const handleAdd = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;

    const note: NoteItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text,
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => [note, ...prev]);
    setInputValue('');
  }, [inputValue]);

  const handleRemove = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd],
  );

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <Card title="Заметки">
      <div className="flex flex-col gap-3">
        {/* Input row */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Добавить заметку…"
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            title="Добавить заметку"
            aria-label="Добавить заметку"
          >
            <Plus size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Notes list */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {notes.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-neutral-500">
              <StickyNote size={24} aria-hidden="true" />
              <span className="text-xs">Заметок пока нет</span>
            </div>
          )}
          {notes.map((note) => (
            <div
              key={note.id}
              className="group flex items-start justify-between gap-2 p-2 rounded-md bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-700 break-words">{note.text}</p>
                <span className="text-xs text-neutral-400">{formatDate(note.createdAt)}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(note.id)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-neutral-400 hover:text-danger transition-all focus:outline-none focus:ring-2 focus:ring-primary rounded"
                title="Удалить заметку"
                aria-label={`Удалить заметку "${note.text}"`}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

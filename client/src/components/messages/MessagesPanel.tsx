import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMessageStore, Message } from '../../model/stores/messageStore';
import { usePresenceStore } from '../../model/stores/presenceStore';
import { getJwtUserId, loadFavorites, saveFavorites } from '../../services/objectClient';
import { useMessaging } from '../../hooks/useMessaging';
import { deleteMessage } from '../../services/messageClient';
import { listAllProfiles, type ProfileEntry } from '../../services/profileClient';

// ── Styles ────────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 360,
  zIndex: 450,
  background: 'rgba(10,10,15,0.97)',
  borderLeft: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(12px)',
  display: 'flex',
  flexDirection: 'column',
  color: '#fff',
  fontFamily: 'inherit',
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  resize: 'none',
  fontFamily: 'inherit',
};

// ── Konversationsliste ────────────────────────────────────────────────────────

interface ConvEntry {
  userId: string;
  name: string;
  isOnline: boolean;
  unread: number;
  lastBody: string;
  lastAt: string;
  isFavorite: boolean;
}

function isMessageable(userId: string, name: string): boolean {
  if (userId.startsWith('bot_') || name.endsWith('_Bot')) return false;
  if (userId.startsWith('g_')) return false;
  return true;
}

function buildConversations(
  inbox: Message[],
  onlineUsers: Record<string, { name: string }>,
  allProfiles: ProfileEntry[],
  favorites: string[],
  myId: string,
): ConvEntry[] {
  const favSet = new Set(favorites);
  const map    = new Map<string, ConvEntry>();

  for (const msg of inbox) {
    const otherId     = msg.senderId === myId ? msg.recipientId : msg.senderId;
    const onlineName  = onlineUsers[otherId]?.name;
    const profileName = allProfiles.find((p) => p.userId === otherId)?.displayName;
    const otherName   = onlineName ?? profileName ?? otherId;
    if (!isMessageable(otherId, otherName)) continue;
    const existing = map.get(otherId);
    if (!existing) {
      map.set(otherId, {
        userId: otherId, name: otherName, isOnline: !!onlineUsers[otherId],
        unread:   msg.recipientId === myId && !msg.readAt ? 1 : 0,
        lastBody: msg.body, lastAt: msg.createdAt,
        isFavorite: favSet.has(otherId),
      });
    } else {
      if (msg.createdAt > existing.lastAt) {
        existing.lastBody = msg.body; existing.lastAt = msg.createdAt;
      }
      if (msg.recipientId === myId && !msg.readAt) existing.unread++;
    }
  }

  for (const [uid, u] of Object.entries(onlineUsers)) {
    if (uid !== myId && !map.has(uid) && isMessageable(uid, u.name)) {
      map.set(uid, {
        userId: uid, name: u.name, isOnline: true,
        unread: 0, lastBody: '', lastAt: '', isFavorite: favSet.has(uid),
      });
    }
  }

  for (const p of allProfiles) {
    if (p.userId !== myId && !map.has(p.userId) && isMessageable(p.userId, p.displayName)) {
      map.set(p.userId, {
        userId: p.userId, name: p.displayName, isOnline: false,
        unread: 0, lastBody: '', lastAt: '', isFavorite: favSet.has(p.userId),
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt);
    if (a.lastAt) return -1;
    if (b.lastAt) return 1;
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.name.localeCompare(b.name, 'de');
  });
}

function convSection(c: ConvEntry): string {
  if (c.isFavorite) return 'Favoriten';
  if (c.lastAt)    return 'Letzte Gespräche';
  return 'Alle Nutzer';
}

// ── Einzel-Nachricht ──────────────────────────────────────────────────────────

const ChatBubble: React.FC<{ msg: Message; isMine: boolean; onDelete: () => void }> = ({
  msg, isMine, onDelete,
}) => {
  const [hover, setHover] = useState(false);
  const time = new Date(msg.createdAt).toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        marginBottom: 6,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{
        maxWidth: '75%',
        background: isMine ? 'rgba(79,142,247,0.75)' : 'rgba(255,255,255,0.1)',
        borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: '8px 12px',
        fontSize: 13,
        lineHeight: 1.45,
        wordBreak: 'break-word',
        position: 'relative',
      }}>
        {msg.body}
        {hover && isMine && (
          <button onClick={onDelete} style={{
            position: 'absolute', top: -8, right: -8,
            background: 'rgba(239,68,68,0.85)', border: 'none',
            borderRadius: '50%', width: 18, height: 18,
            color: '#fff', fontSize: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        )}
      </div>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
        {time}{isMine && msg.readAt ? ' · gelesen' : ''}
      </span>
    </div>
  );
};

// ── Chat-Ansicht ──────────────────────────────────────────────────────────────

const ChatView: React.FC<{ userId: string; name: string; isOnline: boolean }> = ({
  userId, name, isOnline,
}) => {
  const myId           = getJwtUserId();
  const activeMessages = useMessageStore((s) => s.activeMessages);
  const { sendMessage } = useMessaging();
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const handleSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError('');
    setText('');
    const ok = await sendMessage(userId, body);
    if (!ok) {
      setSendError('Senden fehlgeschlagen. Bitte erneut versuchen.');
      setText(body);
    }
    setSending(false);
  }, [text, sending, userId, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleDelete = async (id: string) => {
    await deleteMessage(id).catch(() => {});
    useMessageStore.getState().setActiveMessages(
      useMessageStore.getState().activeMessages.filter((m) => m._id !== id),
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isOnline ? '#86efac' : 'rgba(255,255,255,0.25)',
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
        {!isOnline && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>offline</span>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {activeMessages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 40 }}>
            Noch keine Nachrichten. Schreib als Erster!
          </div>
        )}
        {activeMessages.map((msg) => (
          <ChatBubble
            key={msg._id}
            msg={msg}
            isMine={msg.senderId === myId}
            onDelete={() => handleDelete(msg._id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
      }}>
        {sendError && (
          <div style={{ color: '#f87171', fontSize: 11, padding: '2px 4px' }}>{sendError}</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            style={{ ...inputStyle, flex: 1, minHeight: 38, maxHeight: 120 }}
            placeholder="Nachricht schreiben… (Enter = senden)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            style={{
              background: text.trim() ? 'rgba(79,142,247,0.85)' : 'rgba(255,255,255,0.1)',
              border: 'none', borderRadius: 8,
              color: '#fff', fontWeight: 700, fontSize: 16,
              cursor: text.trim() ? 'pointer' : 'default',
              padding: '0 14px', alignSelf: 'flex-end', height: 38,
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Hauptpanel ────────────────────────────────────────────────────────────────

interface Props { onClose: () => void }

const MessagesPanel: React.FC<Props> = ({ onClose }) => {
  const myId          = getJwtUserId();
  const inboxMessages = useMessageStore((s) => s.inboxMessages);
  const activeUserId  = useMessageStore((s) => s.activeUserId);
  const { loadInbox, openConversation } = useMessaging();
  const onlineUsers   = usePresenceStore((s) => s.remoteUsers);

  const [allProfiles, setAllProfiles] = useState<ProfileEntry[]>([]);
  const [favorites,   setFavorites]   = useState<string[]>([]);
  const [favDocId,    setFavDocId]    = useState<string | null>(null);

  useEffect(() => {
    loadInbox();
    if (!myId) return;
    listAllProfiles().then(setAllProfiles).catch(() => {});
    loadFavorites(myId).then(({ docId, favorites: favs }) => {
      setFavDocId(docId);
      setFavorites(favs);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeUserId) openConversation(activeUserId);
  }, [activeUserId, openConversation]);

  const toggleFavorite = useCallback(async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavs = favorites.includes(userId)
      ? favorites.filter((id) => id !== userId)
      : [...favorites, userId];
    setFavorites(newFavs);
    const newDocId = await saveFavorites(myId, newFavs, favDocId);
    if (newDocId && newDocId !== favDocId) setFavDocId(newDocId);
  }, [favorites, favDocId, myId]);

  const conversations = buildConversations(inboxMessages, onlineUsers, allProfiles, favorites, myId);
  const active = activeUserId
    ? conversations.find((c) => c.userId === activeUserId) ?? {
        userId:     activeUserId,
        name:       onlineUsers[activeUserId]?.name
                    ?? allProfiles.find((p) => p.userId === activeUserId)?.displayName
                    ?? activeUserId,
        isOnline:   !!onlineUsers[activeUserId],
        unread: 0, lastBody: '', lastAt: '', isFavorite: false,
      }
    : null;

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        {active ? (
          <button onClick={() => useMessageStore.getState().setActiveUserId(null)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer', fontSize: 18, lineHeight: 1, marginRight: 8,
          }}>←</button>
        ) : null}
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
          {active ? active.name : '💬 Nachrichten'}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: 18, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Konversationsliste */}
      {!active && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              Keine Nutzer gefunden.
            </div>
          )}
          {conversations.map((conv, i) => {
            const section     = convSection(conv);
            const prevSection = i > 0 ? convSection(conversations[i - 1]) : null;
            return (
              <React.Fragment key={conv.userId}>
                {section !== prevSection && (
                  <div style={{
                    padding: '8px 16px 4px',
                    fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    {section}
                  </div>
                )}
                <div
                  onClick={() => useMessageStore.getState().setActiveUserId(conv.userId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{
                    width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                    background: conv.isOnline ? '#86efac' : 'rgba(255,255,255,0.2)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: conv.unread > 0 ? 700 : 400,
                      fontSize: 13,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {conv.name}
                    </div>
                    {conv.lastBody && (
                      <div style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.4)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {conv.lastBody}
                      </div>
                    )}
                  </div>
                  {conv.unread > 0 && (
                    <span style={{
                      background: '#4f8ef7', borderRadius: 10,
                      padding: '1px 7px', fontSize: 11, fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {conv.unread}
                    </span>
                  )}
                  <button
                    onClick={(e) => toggleFavorite(conv.userId, e)}
                    title={conv.isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                    style={{
                      background: 'none', border: 'none',
                      color: conv.isFavorite ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                      cursor: 'pointer', fontSize: 15, padding: '0 2px',
                      flexShrink: 0, lineHeight: 1,
                    }}
                  >
                    {conv.isFavorite ? '★' : '☆'}
                  </button>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Chat-Ansicht */}
      {active && (
        <ChatView
          userId={active.userId}
          name={active.name}
          isOnline={active.isOnline}
        />
      )}
    </div>
  );
};

export default MessagesPanel;

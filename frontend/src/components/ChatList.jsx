import React, { memo } from 'react';
import Avatar from './Avatar';
import { formatChatTime, statusColorFor, statusLabelFor } from './chatHelpers';

/**
 * Sidebar-ul cu lista de conversatii.
 * Memoizat — se re-randeaza DOAR cand chats, activeChatId sau presence se schimba,
 * nu la fiecare mesaj primit in chat-ul activ.
 */
const ChatList = memo(function ChatList({
  chats,
  activeChatId,
  user,
  presence,
  onSelectChat,
  onDeleteChat,
  onNewChat,
  onNewGroup,
  onOpenProfile,
  onLogout,
}) {
  const getPresence = (u) => {
    if (!u) return null;
    return presence[u.id] || u;
  };

  const chatTitle = (c) =>
    c.type === 'DIRECT' ? (c.otherUser?.displayName || c.otherUser?.username) : c.name;

  const presenceDotColor = (u) => {
    const p = getPresence(u);
    if (!p || !p.online) return null;
    return statusColorFor(p.status?.statusType);
  };

  const presenceTooltip = (u) => {
    const p = getPresence(u);
    if (!p || !p.online) return null;
    return statusLabelFor(p.status) || 'Online';
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.sidebarHeader}>
        <Avatar src={user?.avatarUrl} name={user?.displayName} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.meName}>{user?.displayName}</div>
          <div style={styles.meEmail}>{user?.email}</div>
        </div>
        <button onClick={onOpenProfile} style={styles.iconBtn} title="Profil">⚙️</button>
        <button onClick={onLogout} style={styles.iconBtn} title="Logout">➜]</button>
      </div>

      <div style={{ display: 'flex', gap: 6, margin: 12 }}>
        <button onClick={onNewChat} style={{ ...styles.newChatBtn, flex: 1, margin: 0 }}>
          + Chat
        </button>
        <button onClick={onNewGroup} style={{ ...styles.newChatBtn, flex: 1, margin: 0, background: '#f9a8d4' }}>
          + Grup
        </button>
      </div>

      <div style={styles.chatList}>
        {chats.length === 0 && <div style={styles.empty}>Niciun chat încă.</div>}
        {chats.map((c) => {
          const other = c.otherUser;
          const otherLive = other ? getPresence(other) : null;
          const dotColor = presenceDotColor(other);

          return (
            <div
              key={c.id}
              onClick={() => onSelectChat(c.id)}
              style={{
                ...styles.chatItem,
                ...(c.id === activeChatId ? styles.chatItemActive : {}),
              }}
            >
              <div style={{ position: 'relative' }}>
                <Avatar src={otherLive?.avatarUrl} name={chatTitle(c)} />
                {dotColor && (
                  <span
                    style={{ ...styles.onlineDot, background: dotColor }}
                    title={presenceTooltip(other)}
                  />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                  <div style={styles.chatName}>{chatTitle(c)}</div>
                  {c.lastMessage?.createdAt && (
                    <span style={styles.chatTime}>{formatChatTime(c.lastMessage.createdAt)}</span>
                  )}
                  {c.unreadCount > 0 && (
                    <span style={styles.unreadBadge}>{c.unreadCount}</span>
                  )}
                </div>
                <div style={{
                  ...styles.chatSub,
                  fontWeight: c.unreadCount > 0 ? 600 : 400,
                  color: c.unreadCount > 0 ? '#b794f4' : '#888',
                }}>
                  {c.unreadCount > 0
                    ? (c.unreadCount === 1 ? 'Aveți un mesaj nou' : `Aveți ${c.unreadCount} mesaje noi`)
                    : c.lastMessage
                      ? (c.lastMessage.senderId === user?.id ? 'Tu: ' : '') + (c.lastMessage.content || '📎 Atașament')
                      : 'Niciun mesaj încă'}
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); onDeleteChat(c); }}
                style={styles.deleteBtn}
                title="Șterge"
              >🗑</button>
            </div>
          );
        })}
      </div>
    </aside>
  );
});

export default ChatList;

const styles = {
  sidebar: { width: 340, background: '#fff', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 8px rgba(167, 139, 250, 0.05)' },
  sidebarHeader: { padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, #b8a4f0 0%, #9176e3 100%)', color: '#fff', gap: 10 },
  meName: { fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meEmail: { fontSize: 11, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  iconBtn: { background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontSize: 14 },
  newChatBtn: { padding: 11, background: 'linear-gradient(135deg, #b8a4f0 0%, #9176e3 100%)', color: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 600, fontSize: 13, boxShadow: '0 2px 8px rgba(139,111,232,0.25)' },
  chatList: { flex: 1, overflowY: 'auto' },
  chatItem: { display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.2s' },
  chatItemActive: { background: 'var(--primary-soft)', borderLeft: '3px solid var(--primary)' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff' },
  chatName: { fontWeight: 600, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 14 },
  chatTime: { fontSize: 11, color: '#aaa', flexShrink: 0 },
  chatSub: { fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  empty: { padding: 16, textAlign: 'center', color: '#999', fontSize: 13 },
  deleteBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999', padding: 6, borderRadius: 6 },
  unreadBadge: { background: 'linear-gradient(135deg, #b8a4f0 0%, #9176e3 100%)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '3px 9px', minWidth: 20, textAlign: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(139,111,232,0.3)' },
};

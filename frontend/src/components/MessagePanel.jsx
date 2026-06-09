import React, { memo, useRef, useEffect, useState } from 'react';
import Avatar from './Avatar';
import DeliveryStatus from './DeliveryStatus';
import TypingIndicator from './TypingIndicator';
import MessageSearch from './MessageSearch';
import { formatDayLabel, statusColorFor, statusLabelFor } from './chatHelpers';

const GROUP_NAME_COLORS = [
  '#7c3aed', '#ec4899', '#0ea5e9', '#0891b2', '#16a34a',
  '#d97706', '#dc2626', '#9333ea', '#db2777', '#2563eb',
  '#059669', '#ea580c', '#be185d', '#4f46e5',
];

const colorForUser = (id) => {
  if (id == null) return GROUP_NAME_COLORS[0];
  const key = String(id);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return GROUP_NAME_COLORS[h % GROUP_NAME_COLORS.length];
};

const PaperclipIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

/** Atasament inline sau buton de download intr-un mesaj. */
const Attachment = memo(function Attachment({ m, mine }) {
  if (!m.attachmentUrl) return null;
  const isImage = m.attachmentType?.startsWith('image/');
  if (isImage) {
    return (
      <a href={m.attachmentUrl} download={m.attachmentName || 'image'} target="_blank" rel="noreferrer">
        <img
          src={m.attachmentUrl}
          alt={m.attachmentName || ''}
          style={{ maxWidth: 280, maxHeight: 280, borderRadius: 8, display: 'block', marginBottom: 4 }}
        />
      </a>
    );
  }
  return (
    <a
      href={m.attachmentUrl}
      download={m.attachmentName || 'file'}
      style={{
        display: 'inline-flex', gap: 8, alignItems: 'center',
        padding: '8px 12px', borderRadius: 8, marginBottom: 4,
        background: mine ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
        color: mine ? '#fff' : '#111', textDecoration: 'none', fontSize: 13,
      }}
    >
      <PaperclipIcon size={16} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.attachmentName || 'fișier'}</span>
    </a>
  );
});

/**
 * Zona principala de chat: header + lista mesaje + composer.
 * Memoizata — se re-randeaza DOAR cand messages, activeChat, draft sau attachment se schimba.
 * ChatList nu este afectat de sosirea unui mesaj in chat-ul activ.
 */
const MessagePanel = memo(function MessagePanel({
  activeChat,
  messages,
  user,
  presence,
  draft,
  attachments,
  typingUsers,
  dragOver,
  wsReady,
  onDraftChange,
  onSend,
  onFile,
  onRemoveAttachment,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenDetails,
  onSearchResults,
}) {
  const messagesEndRef = useRef(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { setShowSearch(false); }, [activeChat?.id]);

  // Scroll la ultimul mesaj la fiecare update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getPresence = (u) => {
    if (!u) return null;
    return presence[u.id] || u;
  };

  const presenceDotColor = (u) => {
    const p = getPresence(u);
    if (!p || !p.online) return null;
    return statusColorFor(p.status?.statusType);
  };

  const presenceText = (u) => {
    const p = getPresence(u);
    if (!p) return '';
    if (p.online) {
      const lbl = statusLabelFor(p.status);
      if (lbl && p.status?.statusType !== 'ONLINE') return lbl;
      return 'Online';
    }
    if (p.lastSeenAt) {
      const d = new Date(p.lastSeenAt);
      const today = new Date();
      const sameDay = d.toDateString() === today.toDateString();
      return 'Ultima dată: ' + d.toLocaleString('ro-RO',
        sameDay ? { hour: '2-digit', minute: '2-digit' }
                : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    return 'Offline';
  };

  if (!activeChat) {
    return (
      <main style={styles.main}>
        <div style={styles.placeholder}>
          <h2 style={{
            color: 'var(--text-dark)',
            fontWeight: 400,
            fontSize: 56,
            letterSpacing: 0,
            margin: 0,
            fontFamily: '"Parisienne", cursive',
            lineHeight: 1.1,
          }}>
            Bună, {user?.displayName}!
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Selectează o conversație sau începe una nouă.</p>
          {!wsReady && <p style={{ color: '#f59e0b' }}>Se conectează la server...</p>}
        </div>
      </main>
    );
  }

  const chatHeaderAvatar = getPresence(activeChat.otherUser)?.avatarUrl;
  const chatHeaderName = activeChat.type === 'DIRECT'
    ? (activeChat.otherUser?.displayName || activeChat.otherUser?.username)
    : activeChat.name;

  return (
    <main
      key={activeChat.id}
      className="chat-swap"
      style={styles.main}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <header style={styles.chatHeader}>
        <Avatar src={chatHeaderAvatar} name={chatHeaderName} size={44} />
        <div style={{ flex: 1 }}>
          <div style={styles.chatHeaderName}>{chatHeaderName}</div>
          <div style={styles.chatHeaderSub}>
            {activeChat.type === 'DIRECT' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {presenceDotColor(activeChat.otherUser) && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: presenceDotColor(activeChat.otherUser),
                    display: 'inline-block',
                  }} />
                )}
                <span>{presenceText(activeChat.otherUser)}</span>
              </div>
            ) : (
              `${activeChat.members?.length || 0} membri`
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSearch((s) => !s)}
          style={{ ...styles.headerTextBtn, ...(showSearch ? styles.headerTextBtnActive : {}) }}
        >
          Caută
        </button>
        <button type="button" onClick={onOpenDetails} style={styles.headerTextBtn}>
          Detalii
        </button>
      </header>

      {/* Search */}
      {showSearch && (
        <MessageSearch chatId={activeChat.id} onResults={onSearchResults} />
      )}

      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.emptyMessages}>Niciun mesaj încă. Scrie ceva!</div>
        )}
        {messages.map((m, idx) => {
          const mine = m.senderId === user?.id;
          const prev = idx > 0 ? messages[idx - 1] : null;
          const showDayHeader = !prev ||
            new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          return (
            <React.Fragment key={m.id}>
              {showDayHeader && (
                <div style={styles.dayDivider}>
                  <span style={styles.dayPill}>{formatDayLabel(m.createdAt)}</span>
                </div>
              )}
              <div style={{ ...styles.msgRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.bubble, ...(mine ? styles.bubbleMine : styles.bubbleTheirs) }}>
                  {!mine && (
                    <div style={{
                      ...styles.bubbleSender,
                      color: activeChat.type === 'GROUP' ? colorForUser(m.senderId) : styles.bubbleSender.color,
                    }}>
                      {m.senderDisplayName}
                    </div>
                  )}
                  <Attachment m={m} mine={mine} />
                  {m.content && <div>{m.content}</div>}
                  <div style={styles.bubbleTime}>
                    {new Date(m.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                    {mine && (
                      <DeliveryStatus
                        status={m.deliveryStatus}
                        deliveredAt={m.deliveredAt}
                        readAt={m.readAt}
                      />
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments preview */}
      {attachments?.length > 0 && (
        <div style={styles.attachmentPreview}>
          {attachments.map((a) => {
            const isImage = a.type?.startsWith('image/');
            return (
              <div
                key={a.tempId}
                style={{
                  position: 'relative',
                  width: isImage ? 72 : 'auto',
                  height: 72,
                  maxWidth: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: isImage ? 0 : '0 12px',
                  background: '#fff',
                  borderRadius: 10,
                  border: '1px solid var(--border, #e5e7eb)',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {isImage && (a.localUrl || a.url) ? (
                  <>
                    <img src={a.localUrl || a.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {a.uploading && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(255,255,255,0.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                      }}>⏳</div>
                    )}
                  </>
                ) : a.uploading ? (
                  <div style={{ fontSize: 12, color: '#666', textAlign: 'center', padding: 4 }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>⏳</div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{a.name}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 200 }}>
                    <PaperclipIcon size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(a.tempId)}
                  aria-label="Elimină"
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, lineHeight: 1, padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Typing indicator */}
      {typingUsers[activeChat.id]?.length > 0 && (
        <div style={styles.typingIndicatorContainer}>
          <TypingIndicator typingUsers={typingUsers[activeChat.id]} />
        </div>
      )}

      {/* Composer */}
      <form onSubmit={onSend} style={styles.composer}>
        <label style={styles.attachBtn} title="Atașează fișiere">
          <PaperclipIcon size={20} color="var(--primary-deep, #6d57d4)" />
          <input
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length) onFile(Array.from(files));
              e.target.value = '';
            }}
          />
        </label>
        <input
          type="text"
          value={draft}
          onChange={onDraftChange}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const pasted = [];
            for (const it of items) {
              if (it.kind === 'file' && it.type.startsWith('image/')) {
                const file = it.getAsFile();
                if (file) {
                  const ext = (file.type.split('/')[1] || 'png').split('+')[0];
                  const named = file.name && file.name !== 'image.png'
                    ? file
                    : new File([file], `pasted-${Date.now()}-${pasted.length}.${ext}`, { type: file.type });
                  pasted.push(named);
                }
              }
            }
            if (pasted.length) {
              e.preventDefault();
              onFile(pasted);
            }
          }}
          placeholder={attachments?.length > 0 ? 'Adaugă text (opțional)...' : 'Scrie un mesaj sau trage un fișier aici...'}
          style={styles.composerInput}
        />
        <button type="submit" style={styles.sendBtn} disabled={!draft.trim() && !(attachments?.length > 0)}>
          Trimite
        </button>
      </form>

      {/* Drag-over overlay */}
      {dragOver && (
        <div style={styles.dropOverlay}>
          <div style={styles.dropOverlayBox}>📂 Eliberează ca să atașezi fișierul</div>
        </div>
      )}
    </main>
  );
});

export default MessagePanel;

const styles = {
  main: { flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' },
  placeholder: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#666' },
  chatHeader: { display: 'flex', gap: 12, alignItems: 'center', padding: '14px 22px', background: '#fff', borderBottom: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(167,139,250,0.04)' },
  chatHeaderName: { fontWeight: 700, fontSize: 16, color: 'var(--text-dark)', letterSpacing: -0.2 },
  chatHeaderSub: { fontSize: 12, color: '#888' },
  iconBtnDark: { background: 'rgba(0,0,0,0.06)', color: 'var(--text-dark)', border: 'none', borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontSize: 14 },
  headerTextBtn: { background: 'var(--primary-soft, #ede9fe)', color: 'var(--primary-deep, #6d57d4)', border: '1px solid transparent', borderRadius: 999, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, letterSpacing: 0.2, transition: 'all 0.18s ease', boxShadow: '0 1px 2px rgba(109, 87, 212, 0.08)' },
  headerTextBtnActive: { background: 'var(--primary, #a78bfa)', color: '#fff', boxShadow: '0 4px 12px rgba(139, 111, 232, 0.3)' },
  messages: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  emptyMessages: { textAlign: 'center', color: '#999', marginTop: 40 },
  dayDivider: { display: 'flex', justifyContent: 'center', margin: '12px 0 8px' },
  dayPill: { fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-muted)', background: 'var(--bg-soft)', padding: '5px 14px', borderRadius: 999, border: '1px solid var(--border)', textTransform: 'uppercase' },
  msgRow: { display: 'flex' },
  bubble: { maxWidth: '60%', padding: '8px 12px', borderRadius: 12, fontSize: 14, wordBreak: 'break-word' },
  bubbleMine: { background: 'linear-gradient(135deg, #b8a4f0 0%, #9176e3 100%)', color: '#fff', borderBottomRightRadius: 4, boxShadow: '0 2px 8px rgba(139,111,232,0.25)' },
  bubbleTheirs: { background: '#fff', color: 'var(--text-dark)', border: '1px solid var(--border)', borderBottomLeftRadius: 4, boxShadow: '0 1px 4px rgba(167,139,250,0.06)' },
  bubbleSender: { fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#b794f4' },
  bubbleTime: { fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: 'right' },
  composer: { display: 'flex', gap: 10, padding: 14, background: '#fff', borderTop: '1px solid var(--border)', alignItems: 'center' },
  composerInput: { flex: 1, padding: '12px 18px', borderRadius: 999, border: '1.5px solid var(--border)', background: 'var(--bg-soft)', fontSize: 14, outline: 'none', color: 'var(--text-dark)' },
  sendBtn: { padding: '10px 22px', background: 'linear-gradient(135deg, #b8a4f0 0%, #9176e3 100%)', color: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 8px rgba(139,111,232,0.25)' },
  attachBtn: { cursor: 'pointer', fontSize: 22, padding: '6px 10px', borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center' },
  typingIndicatorContainer: { padding: '8px 20px', background: 'var(--bg-soft)', fontSize: 12, borderTop: '1px solid var(--border)' },
  attachmentPreview: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: 10, background: 'var(--primary-soft)', borderTop: '1px solid var(--border)' },
  removeAttachBtn: { marginLeft: 'auto', background: '#fff', border: '1px solid #ddd', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 16 },
  dropOverlay: { position: 'absolute', inset: 0, background: 'rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 50 },
  dropOverlayBox: { background: '#b794f4', color: '#fff', padding: '16px 24px', borderRadius: 12, fontWeight: 600, fontSize: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' },
};

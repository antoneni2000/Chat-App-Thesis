import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { listMyChats, listAllUsers, createDirectChat, getChatMessages } from '../api/chats';
import * as ws from '../websocket/stompClient';

export default function ChatPage() {
  const { user, logout } = useAuth();

  const [chats, setChats] = useState([]);                    // toate chat-urile mele
  const [activeChat, setActiveChat] = useState(null);        // chat-ul deschis acum
  const [messages, setMessages] = useState([]);              // mesajele chat-ului activ
  const [draft, setDraft] = useState('');                    // textul scris în input
  const [showNewChat, setShowNewChat] = useState(false);     // modalul "new chat"
  const [allUsers, setAllUsers] = useState([]);              // pentru modalul de new chat
  const [wsReady, setWsReady] = useState(false);

  const subscriptionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 1. La mount: încarcă chat-urile + conectează WebSocket
  useEffect(() => {
    listMyChats().then(setChats).catch(console.error);

    const token = localStorage.getItem('token');
    ws.connect(token)
      .then(() => setWsReady(true))
      .catch((err) => console.error('WS connect failed:', err));

    return () => {
      // la unmount (logout), curăță conexiunea
      ws.disconnect();
    };
  }, []);

  // 2. Când userul selectează un chat: încarcă istoricul + subscribe la topic
  useEffect(() => {
    if (!activeChat || !wsReady) return;

    // încarcă istoricul
    getChatMessages(activeChat.id).then(setMessages).catch(console.error);

    // subscribe la mesaje noi pe acest chat
    const sub = ws.subscribe(`/topic/chat/${activeChat.id}`, (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
    });
    subscriptionRef.current = sub;

    return () => {
      // când schimbi chatul, anulează abonamentul vechi
      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
    };
  }, [activeChat, wsReady]);

  // 3. Scroll automat în jos când apare un mesaj nou
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!draft.trim() || !activeChat || !wsReady) return;
    ws.publish('/app/chat.send', { chatId: activeChat.id, content: draft.trim() });
    setDraft('');
  };

  const openNewChat = async () => {
    const users = await listAllUsers();
    setAllUsers(users);
    setShowNewChat(true);
  };

  const startChatWith = async (otherUser) => {
    const chat = await createDirectChat(otherUser.id);
    setShowNewChat(false);
    // adaugă în listă dacă nu există deja
    setChats((prev) => (prev.find((c) => c.id === chat.id) ? prev : [chat, ...prev]));
    setActiveChat(chat);
  };

  const chatTitle = (c) =>
    c.type === 'DIRECT' ? (c.otherUser?.displayName || c.otherUser?.username) : c.name;

  return (
    <div style={styles.container}>
      {/* ===== Sidebar stânga ===== */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div>
            <div style={styles.meName}>{user?.displayName}</div>
            <div style={styles.meEmail}>{user?.email}</div>
          </div>
          <button onClick={logout} style={styles.logoutBtn} title="Logout">↩</button>
        </div>

        <button onClick={openNewChat} style={styles.newChatBtn}>
          + Conversație nouă
        </button>

        <div style={styles.chatList}>
          {chats.length === 0 && (
            <div style={styles.empty}>Niciun chat încă. Apasă "+ Conversație nouă".</div>
          )}
          {chats.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveChat(c)}
              style={{
                ...styles.chatItem,
                ...(activeChat?.id === c.id ? styles.chatItemActive : {}),
              }}
            >
              <div style={styles.avatar}>{(chatTitle(c) || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.chatName}>{chatTitle(c)}</div>
                <div style={styles.chatSub}>{c.type === 'DIRECT' ? 'Conversație directă' : 'Grup'}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ===== Zona de chat (dreapta) ===== */}
      <main style={styles.main}>
        {!activeChat ? (
          <div style={styles.placeholder}>
            <h2>Bună, {user?.displayName}! 👋</h2>
            <p>Selectează o conversație din stânga sau începe una nouă.</p>
            {!wsReady && <p style={{ color: '#f59e0b' }}>Se conectează la server...</p>}
          </div>
        ) : (
          <>
            <header style={styles.chatHeader}>
              <div style={styles.avatar}>{(chatTitle(activeChat) || '?')[0].toUpperCase()}</div>
              <div>
                <div style={styles.chatHeaderName}>{chatTitle(activeChat)}</div>
                <div style={styles.chatHeaderSub}>
                  {wsReady ? '🟢 Conectat' : '🟡 Se conectează...'}
                </div>
              </div>
            </header>

            <div style={styles.messages}>
              {messages.length === 0 && (
                <div style={styles.emptyMessages}>Niciun mesaj încă. Scrie ceva!</div>
              )}
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} style={{ ...styles.msgRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ ...styles.bubble, ...(mine ? styles.bubbleMine : styles.bubbleTheirs) }}>
                      {!mine && <div style={styles.bubbleSender}>{m.senderDisplayName}</div>}
                      <div>{m.content}</div>
                      <div style={styles.bubbleTime}>
                        {new Date(m.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} style={styles.composer}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Scrie un mesaj..."
                style={styles.composerInput}
                disabled={!wsReady}
              />
              <button type="submit" style={styles.sendBtn} disabled={!wsReady || !draft.trim()}>
                Trimite
              </button>
            </form>
          </>
        )}
      </main>

      {/* ===== Modal "Conversație nouă" ===== */}
      {showNewChat && (
        <div style={styles.modalOverlay} onClick={() => setShowNewChat(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Începe o conversație</h3>
            <p style={{ color: '#666', fontSize: 13 }}>Alege un user din listă:</p>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {allUsers.length === 0 && <div style={styles.empty}>Niciun alt user disponibil.</div>}
              {allUsers.map((u) => (
                <div key={u.id} onClick={() => startChatWith(u)} style={styles.userPickItem}>
                  <div style={styles.avatar}>{u.displayName?.[0]?.toUpperCase() || '?'}</div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{u.displayName}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>@{u.username}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowNewChat(false)} style={styles.cancelBtn}>Anulează</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', background: '#f5f7fb', overflow: 'hidden' },

  sidebar: { width: 320, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: 16, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2563eb', color: '#fff' },
  meName: { fontWeight: 600, fontSize: 15 },
  meEmail: { fontSize: 12, opacity: 0.85 },
  logoutBtn: { background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 18 },

  newChatBtn: { margin: 12, padding: 10, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 },

  chatList: { flex: 1, overflowY: 'auto' },
  chatItem: { display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' },
  chatItemActive: { background: '#eff6ff' },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 },
  chatName: { fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chatSub: { fontSize: 12, color: '#888' },
  empty: { padding: 16, textAlign: 'center', color: '#999', fontSize: 13 },

  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  placeholder: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#666' },

  chatHeader: { display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb' },
  chatHeaderName: { fontWeight: 600, fontSize: 16 },
  chatHeaderSub: { fontSize: 12, color: '#888' },

  messages: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  emptyMessages: { textAlign: 'center', color: '#999', marginTop: 40 },
  msgRow: { display: 'flex' },
  bubble: { maxWidth: '60%', padding: '8px 12px', borderRadius: 12, fontSize: 14, wordBreak: 'break-word' },
  bubbleMine: { background: '#2563eb', color: '#fff', borderBottomRightRadius: 2 },
  bubbleTheirs: { background: '#fff', color: '#111', border: '1px solid #e5e7eb', borderBottomLeftRadius: 2 },
  bubbleSender: { fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#2563eb' },
  bubbleTime: { fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: 'right' },

  composer: { display: 'flex', gap: 8, padding: 12, background: '#fff', borderTop: '1px solid #e5e7eb' },
  composerInput: { flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #ddd', fontSize: 14, outline: 'none' },
  sendBtn: { padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 500 },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { background: '#fff', padding: 24, borderRadius: 12, width: 400, maxWidth: '90%' },
  userPickItem: { display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderRadius: 8, cursor: 'pointer' },
  cancelBtn: { marginTop: 12, width: '100%', padding: 10, background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' },
};

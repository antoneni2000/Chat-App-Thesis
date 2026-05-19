import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  listMyChats, listAllUsers, createDirectChat, createGroup,
  getChatMessages, deleteChat, updateMyProfile, markChatAsRead, sendMessage,
  deleteMyAccount,
} from '../api/chats';
import * as ws from '../websocket/stompClient';

// formateaza timestamp-ul pentru sidebar (WhatsApp style: "10:42", "ieri", "07.05")
function formatChatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (sameDay) return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'ieri';
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
}

// afiseaza atasamentul intr-un mesaj: imagine inline sau buton de download
function Attachment({ m, mine }) {
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
        color: mine ? '#fff' : '#111',
        textDecoration: 'none', fontSize: 13,
      }}
    >
      📎 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.attachmentName || 'fișier'}</span>
    </a>
  );
}

// definit la nivel de modul ca sa nu se remonteze img la fiecare render
function Avatar({ src, name, size = 40 }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#2563eb', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, flexShrink: 0, fontSize: size * 0.4,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

export default function ChatPage() {
  const { user, logout, updateUser } = useAuth();

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState(null);   // {url, name, type}
  const [dragOver, setDragOver] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDetails, setShowDetails] = useState(false);   // panou de detalii chat
  const [allUsers, setAllUsers] = useState([]);
  const [wsReady, setWsReady] = useState(false);
  // mapa cu prezenta (id -> {online, lastSeenAt, avatarUrl})
  const [presence, setPresence] = useState({});

  const fileInputRef = useRef(null);
  const chatSubRef = useRef(null);
  const userSubRef = useRef(null);
  const userDelSubRef = useRef(null);
  const presSubRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    listMyChats().then(setChats).catch(console.error);
    const token = localStorage.getItem('token');
    ws.connect(token).then(() => setWsReady(true)).catch(console.error);
    return () => ws.disconnect();
  }, []);

  useEffect(() => {
    if (!wsReady || !user?.id) return;

    userSubRef.current = ws.subscribe(`/topic/user/${user.id}/chats`, (newOrUpdatedChat) => {
      // SCOATE chat-ul de oriunde ar fi si PUNE-L PRIMUL — așa se ordonează cronologic
      setChats((prev) => {
        const filtered = prev.filter((c) => c.id !== newOrUpdatedChat.id);
        return [newOrUpdatedChat, ...filtered];
      });
    });

    userDelSubRef.current = ws.subscribe(`/topic/user/${user.id}/chats/deleted`, (chatId) => {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      setActiveChat((prev) => (prev?.id === chatId ? null : prev));
    });

    // prezenta globala — orice user devine online/offline / isi schimba profilul
    presSubRef.current = ws.subscribe('/topic/presence', (u) => {
      setPresence((prev) => ({ ...prev, [u.id]: u }));
      // si actualizeaza otherUser-ul chat-urilor (sa apara avatar nou, etc.)
      setChats((prev) => prev.map((c) =>
        c.otherUser?.id === u.id ? { ...c, otherUser: { ...c.otherUser, ...u } } : c
      ));
    });

    // re-fetch chats la fiecare conectare WS — evita pierderi de evenimente
    listMyChats().then(setChats).catch(console.error);

    return () => {
      userSubRef.current?.unsubscribe();
      userDelSubRef.current?.unsubscribe();
      presSubRef.current?.unsubscribe();
    };
  }, [wsReady, user?.id]);

  useEffect(() => {
    if (!activeChat?.id || !wsReady) return;
    const chatId = activeChat.id;
    getChatMessages(chatId).then(setMessages).catch(console.error);
    markChatAsRead(chatId).catch(console.error);

    chatSubRef.current = ws.subscribe(`/topic/chat/${chatId}`, (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
      markChatAsRead(chatId).catch(console.error);
    });
    return () => chatSubRef.current?.unsubscribe();
    // IMPORTANT: depind DOAR de id, nu de obiectul intreg, sa nu re-subscrie la fiecare update
  }, [activeChat?.id, wsReady]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // sincronizeaza activeChat cu chats — daca otherUser-ul si-a schimbat avatar/nume,
  // activeChat trebuie sa primeasca varianta noua
  useEffect(() => {
    if (!activeChat) return;
    const fresh = chats.find((c) => c.id === activeChat.id);
    if (fresh && fresh !== activeChat) setActiveChat(fresh);
  }, [chats]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!activeChat) return;
    if (!draft.trim() && !attachment) return;
    try {
      // Folosim REST (nu WS) — HTTP nu are limita de frame pentru atasamente mari
      await sendMessage(activeChat.id, draft.trim(), attachment);
      setDraft('');
      setAttachment(null);
    } catch (err) {
      alert('Eroare la trimitere: ' + (err.response?.data?.error || err.message));
    }
  };

  // converteste un File la base64 si il salveaza in state
  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Fisierul e prea mare. Max 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ url: reader.result, name: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  // drag & drop pe zona de chat
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const openNewChat = async () => {
    const users = await listAllUsers();
    setAllUsers(users);
    setShowNewChat(true);
  };

  const openNewGroup = async () => {
    const users = await listAllUsers();
    setAllUsers(users);
    setShowNewGroup(true);
  };

  const handleCreateGroup = async (name, memberIds) => {
    try {
      const chat = await createGroup(name, memberIds);
      setShowNewGroup(false);
      setChats((prev) => (prev.find((c) => c.id === chat.id) ? prev : [chat, ...prev]));
      setActiveChat(chat);
    } catch (err) {
      alert('Eroare la creare grup: ' + (err.response?.data?.error || err.message));
    }
  };

  const startChatWith = async (otherUser) => {
    const chat = await createDirectChat(otherUser.id);
    setShowNewChat(false);
    setChats((prev) => (prev.find((c) => c.id === chat.id) ? prev : [chat, ...prev]));
    setActiveChat(chat);
  };

  const handleDeleteChat = async (chat, e) => {
    e.stopPropagation();
    if (!confirm(`Sterg conversatia cu ${chatTitle(chat)} (doar pentru tine)?`)) return;
    try {
      await deleteChat(chat.id);
      setChats((prev) => prev.filter((c) => c.id !== chat.id));
      if (activeChat?.id === chat.id) setActiveChat(null);
    } catch (err) {
      alert('Eroare la stergere: ' + (err.response?.data?.error || err.message));
    }
  };

  const chatTitle = (c) =>
    c.type === 'DIRECT' ? (c.otherUser?.displayName || c.otherUser?.username) : c.name;

  // info de prezenta cu actualizari live din presence map
  const getPresence = (u) => {
    if (!u) return null;
    return presence[u.id] || u;
  };

  const presenceText = (u) => {
    const p = getPresence(u);
    if (!p) return '';
    if (p.online) return '🟢 Online';
    if (p.lastSeenAt) {
      const d = new Date(p.lastSeenAt);
      const today = new Date();
      const sameDay = d.toDateString() === today.toDateString();
      return '🕒 Ultima dată: ' + d.toLocaleString('ro-RO',
        sameDay ? { hour: '2-digit', minute: '2-digit' }
                : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    return '⚪ Offline';
  };

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <Avatar src={user?.avatarUrl} name={user?.displayName} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.meName}>{user?.displayName}</div>
            <div style={styles.meEmail}>{user?.email}</div>
          </div>
          <button onClick={() => setShowProfile(true)} style={styles.iconBtn} title="Profil">⚙</button>
          <button onClick={logout} style={styles.iconBtn} title="Logout">↩</button>
        </div>

        <div style={{ display: 'flex', gap: 6, margin: 12 }}>
          <button onClick={openNewChat} style={{ ...styles.newChatBtn, flex: 1, margin: 0 }}>
            + Chat
          </button>
          <button onClick={openNewGroup} style={{ ...styles.newChatBtn, flex: 1, margin: 0, background: '#7c3aed' }}>
            + Grup
          </button>
        </div>

        <div style={styles.chatList}>
          {chats.length === 0 && <div style={styles.empty}>Niciun chat încă.</div>}
          {chats.map((c) => {
            const other = c.otherUser;
            const otherLive = other ? getPresence(other) : null;
            return (
              <div
                key={c.id}
                onClick={() => setActiveChat(c)}
                style={{
                  ...styles.chatItem,
                  ...(activeChat?.id === c.id ? styles.chatItemActive : {}),
                }}
              >
                <div style={{ position: 'relative' }}>
                  <Avatar src={otherLive?.avatarUrl} name={chatTitle(c)} />
                  {otherLive?.online && <span style={styles.onlineDot} />}
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
                    color: c.unreadCount > 0 ? '#2563eb' : '#888',
                  }}>
                    {c.unreadCount > 0
                      ? (c.unreadCount === 1 ? 'Aveți un mesaj nou' : `Aveți ${c.unreadCount} mesaje noi`)
                      : c.lastMessage
                        ? (c.lastMessage.senderId === user?.id ? 'Tu: ' : '') + c.lastMessage.content
                        : 'Niciun mesaj încă'}
                  </div>
                </div>
                <button onClick={(e) => handleDeleteChat(c, e)} style={styles.deleteBtn} title="Șterge">🗑</button>
              </div>
            );
          })}
        </div>
      </aside>

      <main
        style={styles.main}
        onDragOver={activeChat ? onDragOver : undefined}
        onDragLeave={activeChat ? onDragLeave : undefined}
        onDrop={activeChat ? onDrop : undefined}
      >
        {!activeChat ? (
          <div style={styles.placeholder}>
            <h2>Bună, {user?.displayName}! 👋</h2>
            <p>Selectează o conversație sau începe una nouă.</p>
            {!wsReady && <p style={{ color: '#f59e0b' }}>Se conectează la server...</p>}
          </div>
        ) : (
          <>
            <header style={styles.chatHeader}>
              <Avatar src={getPresence(activeChat.otherUser)?.avatarUrl} name={chatTitle(activeChat)} size={44} />
              <div style={{ flex: 1 }}>
                <div style={styles.chatHeaderName}>{chatTitle(activeChat)}</div>
                <div style={styles.chatHeaderSub}>
                  {activeChat.type === 'DIRECT'
                    ? presenceText(activeChat.otherUser)
                    : `${activeChat.members?.length || 0} membri`}
                </div>
              </div>
              <button onClick={() => setShowDetails(true)} style={styles.iconBtnDark} title="Detalii">ℹ</button>
            </header>

            <div style={styles.messages}>
              {messages.length === 0 && <div style={styles.emptyMessages}>Niciun mesaj încă. Scrie ceva!</div>}
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} style={{ ...styles.msgRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ ...styles.bubble, ...(mine ? styles.bubbleMine : styles.bubbleTheirs) }}>
                      {!mine && <div style={styles.bubbleSender}>{m.senderDisplayName}</div>}
                      <Attachment m={m} mine={mine} />
                      {m.content && <div>{m.content}</div>}
                      <div style={styles.bubbleTime}>
                        {new Date(m.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* preview pentru atasamentul pending */}
            {attachment && (
              <div style={styles.attachmentPreview}>
                {attachment.type?.startsWith('image/') ? (
                  <img src={attachment.url} alt="" style={{ height: 60, borderRadius: 6 }} />
                ) : (
                  <div style={{ fontSize: 13 }}>📎 {attachment.name}</div>
                )}
                <button type="button" onClick={() => setAttachment(null)} style={styles.removeAttachBtn}>×</button>
              </div>
            )}

            <form onSubmit={handleSend} style={styles.composer}>
              <label style={styles.attachBtn} title="Atașează fișier">
                📎
                <input
                  type="file"
                  hidden
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={attachment ? 'Adaugă text (opțional)...' : 'Scrie un mesaj sau trage un fișier aici...'}
                style={styles.composerInput}
              />
              <button type="submit" style={styles.sendBtn} disabled={!draft.trim() && !attachment}>
                Trimite
              </button>
            </form>

            {/* overlay vizual cand tragi un fisier */}
            {dragOver && (
              <div style={styles.dropOverlay}>
                <div style={styles.dropOverlayBox}>📂 Eliberează ca să atașezi fișierul</div>
              </div>
            )}
          </>
        )}
      </main>

      {showNewChat && (
        <div style={styles.modalOverlay} onClick={() => setShowNewChat(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Începe o conversație</h3>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {allUsers.length === 0 && <div style={styles.empty}>Niciun alt user.</div>}
              {allUsers.map((u) => (
                <div key={u.id} onClick={() => startChatWith(u)} style={styles.userPickItem}>
                  <Avatar src={u.avatarUrl} name={u.displayName} />
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

      {showNewGroup && (
        <NewGroupModal
          allUsers={allUsers}
          onClose={() => setShowNewGroup(false)}
          onCreate={handleCreateGroup}
        />
      )}

      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onSaved={(updated) => {
            updateUser({
              displayName: updated.displayName,
              email: updated.email,
              avatarUrl: updated.avatarUrl,
            });
            setShowProfile(false);
          }}
          onAccountDeleted={() => {
            logout();
          }}
        />
      )}

      {showDetails && activeChat && (
        <ChatDetailsModal
          chat={activeChat}
          messages={messages}
          currentUserId={user?.id}
          getPresence={getPresence}
          presenceText={presenceText}
          onClose={() => setShowDetails(false)}
          onDelete={async () => {
            if (!confirm('Sterge conversatia doar pentru tine?')) return;
            await deleteChat(activeChat.id);
            setChats((prev) => prev.filter((c) => c.id !== activeChat.id));
            setActiveChat(null);
            setShowDetails(false);
          }}
        />
      )}
    </div>
  );
}

function ChatDetailsModal({ chat, messages, currentUserId, getPresence, presenceText, onClose, onDelete }) {
  const filesShared = messages.filter((m) => m.attachmentUrl);
  const title = chat.type === 'DIRECT'
    ? (chat.otherUser?.displayName || chat.otherUser?.username)
    : chat.name;
  const other = chat.type === 'DIRECT' ? getPresence(chat.otherUser) : null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, width: 480, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Detalii {chat.type === 'GROUP' ? 'grup' : 'conversație'}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
          <Avatar src={other?.avatarUrl} name={title} size={80} />
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>{title}</div>
          {chat.type === 'DIRECT' && (
            <>
              <div style={{ fontSize: 13, color: '#666' }}>@{chat.otherUser?.username}</div>
              <div style={{ fontSize: 13, color: '#666' }}>{chat.otherUser?.email}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{presenceText(chat.otherUser)}</div>
            </>
          )}
          {chat.type === 'GROUP' && (
            <div style={{ fontSize: 13, color: '#666' }}>{chat.members?.length || 0} membri</div>
          )}
        </div>

        {chat.type === 'GROUP' && (
          <>
            <h4 style={{ marginBottom: 8, fontSize: 14, color: '#555' }}>👥 Membri ({chat.members?.length || 0})</h4>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16 }}>
              {chat.members?.map((m) => {
                const live = getPresence(m);
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <Avatar src={live?.avatarUrl} name={m.displayName} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {m.displayName} {m.id === currentUserId && <span style={{ color: '#888' }}>(tu)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>@{m.username}</div>
                    </div>
                    {live?.online && <span style={{ fontSize: 11, color: '#22c55e' }}>● online</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h4 style={{ marginBottom: 8, fontSize: 14, color: '#555' }}>📎 Fișiere partajate ({filesShared.length})</h4>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
          {filesShared.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 13 }}>Niciun fișier încă.</div>}
          {filesShared.map((m) => (
            <a
              key={m.id}
              href={m.attachmentUrl}
              download={m.attachmentName || 'file'}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, borderBottom: '1px solid #f3f4f6', textDecoration: 'none', color: '#111' }}
            >
              {m.attachmentType?.startsWith('image/') ? (
                <img src={m.attachmentUrl} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📄</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.attachmentName || 'fișier'}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  de la {m.senderDisplayName} · {new Date(m.createdAt).toLocaleDateString('ro-RO')}
                </div>
              </div>
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...styles.cancelBtn, flex: 1 }}>Închide</button>
          <button onClick={onDelete} style={{ ...styles.cancelBtn, flex: 1, background: '#fee', color: '#c00', borderColor: '#fcc' }}>
            🗑 Șterge conversația
          </button>
        </div>
      </div>
    </div>
  );
}

function NewGroupModal({ allUsers, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [creating, setCreating] = useState(false);

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || selectedIds.size === 0) return;
    setCreating(true);
    await onCreate(name.trim(), Array.from(selectedIds));
    setCreating(false);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <form onSubmit={submit} style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Creează grup nou</h3>

        <label style={styles.label}>Numele grupului</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          placeholder="ex: Echipa Proiect"
          style={styles.input}
          autoFocus
        />

        <label style={{ ...styles.label, marginTop: 16 }}>
          Membri ({selectedIds.size} selectați)
        </label>
        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          {allUsers.length === 0 && <div style={styles.empty}>Niciun alt user.</div>}
          {allUsers.map((u) => {
            const selected = selectedIds.has(u.id);
            return (
              <div
                key={u.id}
                onClick={() => toggle(u.id)}
                style={{
                  display: 'flex', gap: 12, alignItems: 'center', padding: 10,
                  cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                  background: selected ? '#eff6ff' : '#fff',
                }}
              >
                <input type="checkbox" checked={selected} onChange={() => {}} style={{ pointerEvents: 'none' }} />
                <div style={{ ...styles.avatar, width: 32, height: 32, fontSize: 13 }}>
                  {u.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{u.displayName}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>@{u.username}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ ...styles.cancelBtn, flex: 1, marginTop: 0 }}>
            Anulează
          </button>
          <button
            type="submit"
            disabled={creating || !name.trim() || selectedIds.size === 0}
            style={{ ...styles.sendBtn, flex: 1, borderRadius: 8, background: '#7c3aed' }}
          >
            {creating ? 'Se creează...' : `Creează grup (${selectedIds.size + 1} membri)`}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProfileModal({ user, onClose, onSaved, onAccountDeleted }) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErr('Imaginea e prea mare (max 2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    setErr(''); setSaving(true);
    try {
      const updated = await updateMyProfile({ displayName, email, avatarUrl });
      onSaved(updated);
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirm1 = confirm('Sigur ștergi contul? Toate conversațiile DIRECT și mesajele tale vor fi șterse permanent.');
    if (!confirm1) return;
    const typed = prompt('Pentru confirmare, scrie "STERGE CONT":');
    if (typed !== 'STERGE CONT') {
      alert('Anulat — text incorect.');
      return;
    }
    try {
      await deleteMyAccount();
      alert('Contul a fost șters.');
      onAccountDeleted?.();
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Eroare la ștergere');
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <form onSubmit={save} style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Profilul meu</h3>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ ...styles.avatar, width: 100, height: 100, fontSize: 40 }}>
              {displayName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          <button type="button" onClick={() => fileRef.current?.click()} style={styles.cancelBtn}>
            📷 Schimbă poza
          </button>
          {avatarUrl && (
            <button type="button" onClick={() => setAvatarUrl('')} style={{ ...styles.cancelBtn, color: '#c00' }}>
              Șterge poza
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>

        <label style={styles.label}>Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={100} style={styles.input} />

        <label style={{ ...styles.label, marginTop: 12 }}>Username (nu se poate schimba)</label>
        <input value={user?.username || ''} disabled style={{ ...styles.input, background: '#f3f4f6' }} />

        <label style={{ ...styles.label, marginTop: 12 }}>Email (nu se poate schimba)</label>
        <input value={user?.email || ''} disabled style={{ ...styles.input, background: '#f3f4f6' }} />

        {err && <div style={styles.error}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ ...styles.cancelBtn, flex: 1, marginTop: 0 }}>Anulează</button>
          <button type="submit" disabled={saving} style={{ ...styles.sendBtn, flex: 1, borderRadius: 8 }}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', background: '#f5f7fb', overflow: 'hidden' },

  sidebar: { width: 340, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: 14, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', background: '#2563eb', color: '#fff', gap: 10 },
  meName: { fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meEmail: { fontSize: 11, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  iconBtn: { background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 16 },

  newChatBtn: { margin: 12, padding: 10, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 },

  chatList: { flex: 1, overflowY: 'auto' },
  chatItem: { display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' },
  chatItemActive: { background: '#eff6ff' },
  avatar: { borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' },
  chatName: { fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chatSub: { fontSize: 12, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  empty: { padding: 16, textAlign: 'center', color: '#999', fontSize: 13 },
  deleteBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999', padding: 6, borderRadius: 6 },
  unreadBadge: { background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 10, padding: '2px 8px', minWidth: 20, textAlign: 'center', flexShrink: 0 },

  main: { flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' },
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

  composer: { display: 'flex', gap: 8, padding: 12, background: '#fff', borderTop: '1px solid #e5e7eb', alignItems: 'center' },
  composerInput: { flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #ddd', fontSize: 14, outline: 'none' },
  sendBtn: { padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 500 },
  attachBtn: { cursor: 'pointer', fontSize: 22, padding: '6px 10px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center' },
  attachmentPreview: { display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: '#eff6ff', borderTop: '1px solid #e5e7eb' },
  removeAttachBtn: { marginLeft: 'auto', background: '#fff', border: '1px solid #ddd', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 16 },
  dropOverlay: { position: 'absolute', inset: 0, background: 'rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 50 },
  dropOverlayBox: { background: '#2563eb', color: '#fff', padding: '16px 24px', borderRadius: 12, fontWeight: 600, fontSize: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { background: '#fff', padding: 24, borderRadius: 12, width: 400, maxWidth: '90%' },
  userPickItem: { display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderRadius: 8, cursor: 'pointer' },
  cancelBtn: { marginTop: 0, padding: '8px 14px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 },

  label: { fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6, marginTop: 12, display: 'block' },
  input: { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none', boxSizing: 'border-box' },
  error: { marginTop: 12, padding: 10, background: '#fee', color: '#c00', borderRadius: 6, fontSize: 13 },
};

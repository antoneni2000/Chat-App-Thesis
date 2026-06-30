import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  listMyChats, listAllUsers, createDirectChat, createGroup,
  getChatMessages, deleteChat, updateMyProfile, markChatAsRead, sendMessage,
  deleteMyAccount, uploadFile, setUserStatus, getMyStatus,
  uploadAvatar, deleteAvatar,
} from '../api/chats';
import * as ws from '../websocket/stompClient';
import StatusSelector from '../components/StatusSelector';
import ChatList from '../components/ChatList';
import MessagePanel from '../components/MessagePanel';
import Avatar from '../components/Avatar';
import ChatDetailsModal from '../components/ChatDetailsModal';

export default function ChatPage() {
  const { user, logout, updateUser } = useAuth();

  const [chats, setChats] = useState([]);
  // selectedChatId drives which chat is open
  // activeChat is derived so it always reflects the latest data without a separate sync effect.
  const [selectedChatId, setSelectedChatId] = useState(null);
  const activeChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);   // Array<{url,name,type,size, uploading?, tempId}>
  const [dragOver, setDragOver] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [wsReady, setWsReady] = useState(false);
  // mapa cu prezenta (id -> {online, lastSeenAt, avatarUrl, status})
  const [presence, setPresence] = useState({});
  // mapa cu typing indicators (chatId -> [username1, username2])
  const [typingUsers, setTypingUsers] = useState({});
  // stare personala  statusul meu (DND, Busy, etc.)
  const [myStatus, setMyStatus] = useState(null);

  const chatSubRef = useRef(null);
  const userSubRef = useRef(null);
  const userDelSubRef = useRef(null);
  const presSubRef = useRef(null);
  // typing-indicator debounce: send "start typing" only once per burst,
  // trimite stop typing dupa 2 secunde de niactivitate
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    listMyChats().then((cs) => {
      setChats(cs);
    }).catch(console.error);
    const token = sessionStorage.getItem('token');
    ws.connect(token).then(() => setWsReady(true)).catch(console.error);
    return () => ws.disconnect();
  }, []);

  useEffect(() => {
    if (!wsReady || !user?.id) return;

    userSubRef.current = ws.subscribe(`/topic/user/${user.id}/chats`, (newOrUpdatedChat) => {
      // scoate chat de oriunde ar fi si pune l primul.
      setChats((prev) => {
        const filtered = prev.filter((c) => c.id !== newOrUpdatedChat.id);
        return [newOrUpdatedChat, ...filtered];
      });
    });

    userDelSubRef.current = ws.subscribe(`/topic/user/${user.id}/chats/deleted`, (chatId) => {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      setSelectedChatId((prev) => (prev === chatId ? null : prev));
    });

    // prezenta globala, orice user devine online/offline / isi schimba profilul
    presSubRef.current = ws.subscribe('/topic/presence', (u) => {
      setPresence((prev) => ({ ...prev, [u.id]: u }));
      // si actualizeaza otherUser-ul chat-urilor (sa apara avatar nou, etc.)
      setChats((prev) => prev.map((c) =>
        c.otherUser?.id === u.id ? { ...c, otherUser: { ...c.otherUser, ...u } } : c
      ));
    });

    // re-fetch chats la fiecare conectare WS, evita pierderi de evenimente.
    listMyChats().then((cs) => {
      setChats(cs);
    }).catch(console.error);

    // incarca status-ul meu (afisat in profil + foloseste presence pentru update-uri live)
    getMyStatus().then((s) => {
      setMyStatus(s);
      if (s && user?.id) {
        // sincronizeaza propriul status si in presence map
        setPresence((prev) => ({
          ...prev,
          [user.id]: { ...(prev[user.id] || {}), ...user, status: s },
        }));
      }
    }).catch(console.error);

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
      setMessages((prev) => {
        // daca mesajul exista deja (re-broadcast / optimistic insert), inlocuim-l
        const exists = prev.some((m) => m.id === newMsg.id);
        return exists ? prev.map((m) => (m.id === newMsg.id ? newMsg : m)) : [...prev, newMsg];
      });
      // marcheaza ca READ doar pentru mesaje primite (nu propriile) si doar daca tab-ul e vizibil.
      if (newMsg.senderId !== user?.id && document.visibilityState === 'visible') {
        markChatAsRead(chatId).catch(console.error);
      }
    });

    // subscribe la receipt-uri de citire
    const readSubRef = ws.subscribe(`/topic/chat/${chatId}/read`, (receipt) => {
      if (!receipt || receipt.readerId === user?.id) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId !== user?.id) return m;
          if (m.deliveryStatus === 'READ') return m;
          if (receipt.readAt && new Date(m.createdAt) > new Date(receipt.readAt)) return m;
          return { ...m, deliveryStatus: 'READ', readAt: receipt.readAt };
        })
      );
    });

    // Subscribe la typing indicators
    const typingSubRef = ws.subscribe(`/topic/chat/${chatId}/typing`, (typingData) => {
      if (typingData.userId === user?.id) return;
      setTypingUsers((prev) => {
        const current = prev[chatId] || [];
        if (typingData.isTyping) {
          if (!current.includes(typingData.username)) {
            return { ...prev, [chatId]: [...current, typingData.username] };
          }
        } else {
          return { ...prev, [chatId]: current.filter((u) => u !== typingData.username) };
        }
        return prev;
      });
    });

    // Cand tab-ul redevine vizibil cu chat-ul deschis, re-mark ca read
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        markChatAsRead(chatId).catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      chatSubRef.current?.unsubscribe();
      typingSubRef?.unsubscribe();
      readSubRef?.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(typingTimerRef.current);
      isTypingRef.current = false;
      setTypingUsers((prev) => {
        const updated = { ...prev };
        delete updated[chatId];
        return updated;
      });
    };
    // IMPORTANT: depind DOAR de id, nu de obiectul intreg, sa nu re-subscrie la fiecare update
  }, [activeChat?.id, wsReady]);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    if (!activeChat) return;
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    if (attachments.some((a) => a.uploading)) {
      alert('Așteaptă terminarea încărcării atașamentelor...');
      return;
    }
    try {
      if (wsReady) {
        ws.publish('/app/chat.typing', {
          userId: user.id,
          username: user.username,
          chatId: activeChat.id,
          isTyping: false,
        });
      }

      const appendMessage = (sent) => {
        if (sent && sent.id) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === sent.id);
            return exists ? prev.map((m) => (m.id === sent.id ? sent : m)) : [...prev, sent];
          });
        }
      };

      if (attachments.length === 0) {
        appendMessage(await sendMessage(activeChat.id, text, null));
      } else {
        // text on the first message, rest are attachment-only
        for (let i = 0; i < attachments.length; i++) {
          const msgText = i === 0 ? text : '';
          appendMessage(await sendMessage(activeChat.id, msgText, attachments[i]));
        }
      }

      setDraft('');
      attachments.forEach((a) => { if (a.localUrl) URL.revokeObjectURL(a.localUrl); });
      setAttachments([]);
    } catch (err) {
      alert('Eroare la trimitere: ' + (err.response?.data?.error || err.message));
    }
  }, [activeChat, draft, attachments, wsReady, user]);

  // debounced indicator typing
  const handleDraftChange = useCallback((e) => {
    const newDraft = e.target.value;
    setDraft(newDraft);

    if (!wsReady || !activeChat) return;

    if (newDraft.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        ws.publish('/app/chat.typing', {
          userId: user.id,
          username: user.username,
          chatId: activeChat.id,
          isTyping: true,
        });
      }
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        ws.publish('/app/chat.typing', {
          userId: user.id,
          username: user.username,
          chatId: activeChat.id,
          isTyping: false,
        });
      }, 2000);
    } else {
      clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        ws.publish('/app/chat.typing', {
          userId: user.id,
          username: user.username,
          chatId: activeChat.id,
          isTyping: false,
        });
      }
    }
  }, [wsReady, activeChat, user]);

  // uploadeaza unul sau mai multe fisiere; fiecare apare ca atasament separat.
  const handleFile = useCallback(async (input) => {
    if (!input) return;
    const files = Array.isArray(input) ? input
      : (input instanceof FileList ? Array.from(input) : [input]);
    for (const file of files) {
      if (!file) continue;
      if (file.size > 20 * 1024 * 1024) {
        alert(`"${file.name}" e prea mare. Max 20 MB pe fișier.`);
        continue;
      }
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const localUrl = file.type?.startsWith('image/') ? URL.createObjectURL(file) : null;
      setAttachments((prev) => [...prev, { uploading: true, name: file.name, type: file.type, tempId, localUrl }]);
      try {
        const result = await uploadFile(file);
        setAttachments((prev) => prev.map((a) => a.tempId === tempId
          ? { url: result.url, name: result.name, type: result.contentType, size: result.size, tempId, localUrl }
          : a));
      } catch (err) {
        if (localUrl) URL.revokeObjectURL(localUrl);
        setAttachments((prev) => prev.filter((a) => a.tempId !== tempId));
        alert(`Eroare la upload "${file.name}": ` + (err.response?.data?.error || err.message));
      }
    }
  }, []);

  const handleRemoveAttachment = useCallback((tempId) => {
    setAttachments((prev) => {
      const next = tempId == null ? [] : prev.filter((a) => a.tempId !== tempId);
      const removed = tempId == null ? prev : prev.filter((a) => a.tempId === tempId);
      removed.forEach((a) => { if (a.localUrl) URL.revokeObjectURL(a.localUrl); });
      return next;
    });
  }, []);

  // drag & drop pe zona de chat
  const onDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setDragOver(false); }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length) handleFile(Array.from(files));
  }, [handleFile]);

  const openNewChat = useCallback(async () => {
    const users = await listAllUsers();
    setAllUsers(users);
    setShowNewChat(true);
  }, []);

  const openNewGroup = useCallback(async () => {
    const users = await listAllUsers();
    setAllUsers(users);
    setShowNewGroup(true);
  }, []);

  const handleCreateGroup = async (name, memberIds) => {
    try {
      const chat = await createGroup(name, memberIds);
      setShowNewGroup(false);
      setChats((prev) => (prev.find((c) => c.id === chat.id) ? prev : [chat, ...prev]));
      setSelectedChatId(chat.id);
    } catch (err) {
      alert('Eroare la creare grup: ' + (err.response?.data?.error || err.message));
    }
  };

  const startChatWith = async (otherUser) => {
    const chat = await createDirectChat(otherUser.id);
    setShowNewChat(false);
    setChats((prev) => (prev.find((c) => c.id === chat.id) ? prev : [chat, ...prev]));
    setSelectedChatId(chat.id);
  };

  const handleDeleteChat = useCallback(async (chat) => {
    const title = chat.type === 'DIRECT'
      ? (chat.otherUser?.displayName || chat.otherUser?.username)
      : chat.name;
    if (!confirm(`Sterg conversatia cu ${title} (doar pentru tine)?`)) return;
    try {
      await deleteChat(chat.id);
      setChats((prev) => prev.filter((c) => c.id !== chat.id));
      setSelectedChatId((prev) => (prev === chat.id ? null : prev));
    } catch (err) {
      alert('Eroare la stergere: ' + (err.response?.data?.error || err.message));
    }
  }, []);

  const handleOpenProfile = useCallback(() => setShowProfile(true), []);
  const handleOpenDetails = useCallback(() => setShowDetails(true), []);

  const handleSearchResults = useCallback((results) => {
    if (results.length > 0) setMessages(results);
  }, []);

  return (
    <div style={styles.container}>
      <div style={brandCornerStyle}>Aviel</div>
      <ChatList
        chats={chats}
        activeChatId={selectedChatId}
        user={user}
        presence={presence}
        onSelectChat={setSelectedChatId}
        onDeleteChat={handleDeleteChat}
        onNewChat={openNewChat}
        onNewGroup={openNewGroup}
        onOpenProfile={handleOpenProfile}
        onLogout={logout}
      />

      <MessagePanel
        activeChat={activeChat}
        messages={messages}
        user={user}
        presence={presence}
        draft={draft}
        attachments={attachments}
        typingUsers={typingUsers}
        dragOver={dragOver}
        wsReady={wsReady}
        onDraftChange={handleDraftChange}
        onSend={handleSend}
        onFile={handleFile}
        onRemoveAttachment={handleRemoveAttachment}
        onDragOver={activeChat ? onDragOver : undefined}
        onDragLeave={activeChat ? onDragLeave : undefined}
        onDrop={activeChat ? onDrop : undefined}
        onOpenDetails={handleOpenDetails}
        onSearchResults={handleSearchResults}
      />

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
          currentStatus={myStatus}
          onStatusUpdated={(s) => {
            setMyStatus(s);
            if (user?.id) {
              setPresence((prev) => ({
                ...prev,
                [user.id]: { ...(prev[user.id] || {}), ...user, status: s },
              }));
            }
          }}
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
          messages={messages}
          chat={activeChat}
          onClose={() => setShowDetails(false)}
        />
      )}
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
        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: 8 }}>
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
            style={{ ...styles.sendBtn, flex: 1, borderRadius: 8, background: '#f9a8d4' }}
          >
            {creating ? 'Se creează...' : `Creează grup (${selectedIds.size + 1} membri)`}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProfileModal({ user, onClose, onSaved, onAccountDeleted, currentStatus, onStatusUpdated }) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErr('Imaginea e prea mare (max 5MB).');
      return;
    }
    setErr('');
    setAvatarUploading(true);
    const localPreview = URL.createObjectURL(file);
    setAvatarUrl(localPreview);
    try {
      const updated = await uploadAvatar(file);
      setAvatarUrl(updated.avatarUrl || localPreview);
      onSaved(updated);
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Eroare la upload avatar');
      setAvatarUrl(user?.avatarUrl || '');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      const updated = await deleteAvatar();
      setAvatarUrl('');
      onSaved(updated);
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Eroare la ștergere avatar');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setErr(''); setSaving(true);
    try {
      const updated = await updateMyProfile({ displayName, email });
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
      alert('Anulat - text incorect.');
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

  const handleStatusChange = async (statusText, statusType) => {
    try {
      const newStatus = await setUserStatus(statusText, statusType);
      setErr('');
      onStatusUpdated?.(newStatus);
    } catch (err) {
      setErr('Eroare la actualizarea statusului: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <form onSubmit={save} style={{ ...styles.modal, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Inchide"
          style={{
            position: 'absolute', top: 10, right: 12,
            width: 30, height: 30, borderRadius: '50%',
            border: 'none', background: 'transparent',
            fontSize: 20, lineHeight: 1, color: '#6b7280',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
        <h3 style={{ marginTop: 0 }}>Profilul meu</h3>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 6px' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ ...styles.avatar, width: 100, height: 100, fontSize: 40 }}>
              {displayName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted, #6b7280)', marginBottom: 14 }}>
          @{user?.username}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          <button type="button" onClick={() => fileRef.current?.click()} style={styles.cancelBtn}
            disabled={avatarUploading}>
            {avatarUploading ? 'Se încarcă…' : 'Schimbă poza'}
          </button>
          {avatarUrl && (
            <button type="button" onClick={handleDeleteAvatar} style={{ ...styles.cancelBtn, color: '#c00' }}
              disabled={avatarUploading}>
              Șterge poza
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <StatusSelector onStatusChange={handleStatusChange} currentStatus={currentStatus} />
        </div>

        <label style={styles.label}>Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={100} style={styles.input} />

        <label style={{ ...styles.label, marginTop: 12 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        {err && <div style={styles.error}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ ...styles.cancelBtn, flex: 1, marginTop: 0 }}>Anulează</button>
          <button type="submit" disabled={saving} style={{ ...styles.sendBtn, flex: 1, borderRadius: 8 }}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>

        <hr style={{ margin: '24px 0 12px', border: 0, borderTop: '1px solid #eee' }} />

        <button
          type="button"
          onClick={handleDeleteAccount}
          style={{
            width: '100%', padding: '10px', background: '#fee', color: '#c00',
            border: '1px solid #fcc', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13,
          }}
        >
          🗑 Șterge contul permanent
        </button>
        <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 6 }}>
          Toate conversațiile directe și mesajele tale vor fi șterse.
        </div>
      </form>
    </div>
  );
}

const brandCornerStyle = {
  position: 'fixed',
  left: 14,
  bottom: 10,
  fontFamily: '"Monsieur La Doulaise", cursive',
  fontSize: 32,
  lineHeight: 1,
  color: 'var(--text-muted, #8b85a3)',
  opacity: 0.75,
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 10,
};

const styles = {
  container: { height: '100vh', display: 'flex', background: 'var(--gradient-bg)', overflow: 'hidden', animation: 'fadeIn 0.4s ease-out' },
  avatar: { borderRadius: '50%', background: '#b794f4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 },
  empty: { padding: 16, textAlign: 'center', color: '#999', fontSize: 13 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { background: '#fff', padding: 24, borderRadius: 12, width: 400, maxWidth: '90%' },
  userPickItem: { display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderRadius: 8, cursor: 'pointer' },
  cancelBtn: { marginTop: 0, padding: '8px 14px', background: 'var(--bg-hover)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  sendBtn: { padding: '10px 22px', background: 'linear-gradient(135deg, #b8a4f0 0%, #9176e3 100%)', color: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 8px rgba(139,111,232,0.25)' },
  input: { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none', boxSizing: 'border-box' },
  error: { marginTop: 12, padding: 10, background: '#fee', color: '#c00', borderRadius: 6, fontSize: 13 },
  label: { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4, display: 'block', letterSpacing: 0.2 },
};

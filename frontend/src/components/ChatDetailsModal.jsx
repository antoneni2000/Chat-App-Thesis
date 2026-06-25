import React from 'react';

/**
 * modal cu detaliile chatului / persoanei.
 * firect chat: avatar + nume + @username pe acelasi rand + status
 * grup: nume + lista membri
 * sectiune "Atasamente": toate fisierele trimise in conversatie
 */

function statusColor(statusType) {
  switch (statusType) {
    case 'ONLINE': return '#22c55e';
    case 'AWAY':   return '#eab308';
    case 'DND':    return '#ef4444';
    case 'BUSY':   return '#f97316';
    case 'CUSTOM': return '#3b82f6';
    default:       return '#22c55e';
  }
}

function statusLabel(status) {
  if (status?.statusText) return status.statusText;
  switch (status?.statusType) {
    case 'AWAY':   return 'In pauza';
    case 'DND':    return 'Nu deranjati';
    case 'BUSY':   return 'Ocupat';
    case 'CUSTOM': return 'Personalizat';
    default:       return 'Online';
  }
}

function formatBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

export default function ChatDetailsModal({ chat, messages = [], onClose }) {
  if (!chat) return null;

  const isDirect = chat.type === 'DIRECT';
  const otherUser = chat.otherUser;

  // construim  prezenta (un singur indicator combinat)
  let presenceLine = null;
  if (isDirect && otherUser) {
    if (otherUser.online) {
      presenceLine = { color: statusColor(otherUser.status?.statusType), text: statusLabel(otherUser.status) };
    } else {
      const lastSeenText = otherUser.lastSeenAt
        ? `Ultima data: ${new Date(otherUser.lastSeenAt).toLocaleString('ro-RO')}`
        : 'Offline';
      presenceLine = { color: '#9ca3af', text: lastSeenText };
    }
  }

  // filtreaza mesajele cu atasament + sorteaza descrescator (cele mai noi primele)
  const attachments = (messages || [])
    .filter((m) => m.attachmentUrl && m.attachmentName)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const displayName = isDirect ? (otherUser?.displayName || otherUser?.username) : chat.name;
  const username = isDirect ? otherUser?.username : null;
  const avatarUrl = isDirect ? otherUser?.avatarUrl : null;
  const initial = (displayName || '?')[0]?.toUpperCase();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div className="card-fade" style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.heading}>Detalii conversatie</h3>

        {isDirect && otherUser ? (
          <>
            {/* Avatar + nume + username pe acelasi rand */}
            <div style={styles.headerRow}>
              <div style={{ ...styles.avatar, backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none' }}>
                {!avatarUrl && initial}
              </div>
              <div style={styles.headerText}>
                <div style={styles.displayName}>{displayName}</div>
                {username && <div style={styles.username}>@{username}</div>}
              </div>
            </div>

            {/* Status */}
            {presenceLine && (
              <div style={styles.statusSection}>
                <div style={styles.sectionLabel}>Status</div>
                <div style={styles.statusContent}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: presenceLine.color, display: 'inline-block' }} />
                  <span style={styles.statusText}>{presenceLine.text}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Grup: header cu avatar + numele grupului */}
            <div style={styles.headerRow}>
              <div style={{ ...styles.avatar, background: 'var(--gradient-soft)', color: 'var(--text-dark)' }}>
                {initial}
              </div>
              <div style={styles.headerText}>
                <div style={styles.displayName}>{chat.name}</div>
                <div style={styles.username}>
                  {chat.members?.length || 0} {chat.members?.length === 1 ? 'membru' : 'membri'}
                </div>
              </div>
            </div>

            {/* Lista membri */}
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Membri</div>
              <div style={styles.membersList}>
                {chat.members?.map((member) => (
                  <div key={member.id} style={styles.memberItem}>
                    <div style={{ ...styles.memberAvatar, backgroundImage: member.avatarUrl ? `url(${member.avatarUrl})` : 'none' }}>
                      {!member.avatarUrl && (member.displayName || member.username)?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={styles.memberName}>{member.displayName || member.username}</div>
                      <div style={styles.memberUsername}>@{member.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Atasamente  */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>
            Atasamente {attachments.length > 0 && <span style={styles.count}>({attachments.length})</span>}
          </div>
          {attachments.length === 0 ? (
            <div style={styles.empty}>Niciun fisier in aceasta conversatie</div>
          ) : (
            <div style={styles.attList}>
              {attachments.map((m) => {
                const isImage = m.attachmentType?.startsWith('image/');
                return (
                  <a key={m.id} href={m.attachmentUrl} target="_blank" rel="noreferrer"
                     download={m.attachmentName} style={styles.attItem}>
                    <div style={styles.attThumb}>
                      {isImage
                        ? <img src={m.attachmentUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 22 }}>{m.attachmentType?.includes('pdf') ? '📄' : '📎'}</span>}
                    </div>
                    <div style={styles.attMeta}>
                      <div style={styles.attName}>{m.attachmentName}</div>
                      <div style={styles.attSub}>{formatDate(m.createdAt)}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <button onClick={onClose} className="btn btn-ghost" style={styles.closeBtn}>
          Inchide
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(45, 27, 105, 0.35)', backdropFilter: 'blur(4px)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 200, animation: 'fadeIn 0.2s ease-out',
  },
  modal: {
    background: '#ffffff',
    borderRadius: 18,
    padding: 24,
    width: 440, maxWidth: '92%',
    maxHeight: '85vh', overflowY: 'auto',
    border: '1px solid var(--border)',
    boxShadow: '0 10px 40px rgba(91, 76, 134, 0.18)',
  },
  heading: {
    margin: '0 0 18px',
    fontSize: 16, fontWeight: 700,
    color: 'var(--text-dark)', letterSpacing: -0.2,
  },
  headerRow: {
    display: 'flex', alignItems: 'center', gap: 14,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border)',
  },
  avatar: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'var(--primary)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 700, flexShrink: 0,
    backgroundSize: 'cover', backgroundPosition: 'center',
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  displayName: { fontSize: 17, fontWeight: 700, color: 'var(--text-dark)', letterSpacing: -0.2 },
  username: { fontSize: 13, color: 'var(--text-muted)' },

  section: { marginTop: 18 },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  count: { color: 'var(--primary-hover)', fontWeight: 600 },

  statusSection: {
    marginTop: 18, padding: '12px 14px',
    background: 'var(--bg-soft)', borderRadius: 12,
  },
  statusContent: { display: 'flex', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 13, color: 'var(--text-dark)', fontWeight: 500 },

  empty: {
    padding: '14px 12px', fontSize: 13, color: 'var(--text-muted)',
    background: 'var(--bg-soft)', borderRadius: 10, textAlign: 'center',
  },

  attList: { display: 'flex', flexDirection: 'column', gap: 8 },
  attItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: 10, borderRadius: 12,
    background: 'var(--bg-soft)',
    textDecoration: 'none', color: 'inherit',
    transition: 'background 0.15s, transform 0.15s',
  },
  attThumb: {
    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
    background: 'var(--primary-soft)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  attMeta: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  attName: {
    fontSize: 13, fontWeight: 600, color: 'var(--text-dark)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  attSub: { fontSize: 11, color: 'var(--text-muted)' },

  membersList: { display: 'flex', flexDirection: 'column', gap: 10 },
  memberItem: { display: 'flex', gap: 10, alignItems: 'center' },
  memberAvatar: {
    width: 38, height: 38, borderRadius: '50%',
    background: 'var(--primary)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700,
    backgroundSize: 'cover',
  },
  memberName: { fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' },
  memberUsername: { fontSize: 11, color: 'var(--text-muted)' },

  closeBtn: { width: '100%', marginTop: 18 },
};

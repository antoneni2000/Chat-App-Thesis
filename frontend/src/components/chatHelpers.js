/**
 * Utilitare comune folosite de ChatList, MessagePanel si ChatPage.
 * Functii pure — nu depind de state sau context.
 */

export function statusColorFor(statusType) {
  switch (statusType) {
    case 'ONLINE': return '#22c55e';
    case 'AWAY':   return '#eab308';
    case 'DND':    return '#ef4444';
    case 'BUSY':   return '#f97316';
    case 'CUSTOM': return '#8b5cf6';
    default:       return '#22c55e';
  }
}

export function statusLabelFor(status) {
  if (!status) return null;
  if (status.statusText) return status.statusText;
  switch (status.statusType) {
    case 'AWAY':   return 'In pauza';
    case 'DND':    return 'Nu deranjati';
    case 'BUSY':   return 'Ocupat';
    case 'CUSTOM': return 'Personalizat';
    default:       return null;
  }
}

export function formatDayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDay.getTime() === today.getTime()) return 'Astazi';
  if (msgDay.getTime() === yesterday.getTime()) return 'Ieri';

  const weekdayRaw = d.toLocaleDateString('ro-RO', { weekday: 'long' });
  const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
  const diffDays = Math.round((today - msgDay) / (1000 * 60 * 60 * 24));
  if (diffDays > 0 && diffDays < 7) return weekday;
  const dateStr = d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${weekday} ${dateStr}`;
}

export function formatChatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (sameDay) return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'ieri';
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
}

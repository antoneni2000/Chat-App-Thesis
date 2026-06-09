import React from 'react';

export default function DeliveryStatus({ status, deliveredAt, readAt }) {
  const effective = status || 'PENDING';

  let glyph = '⏱';
  let color = '#90ee90';
  let title = 'In curs de livrare...';

  if (effective === 'READ') {
    glyph = '✓✓';
    color = '#00ff00';
    title = readAt ? ('Citit la ' + fmt(readAt)) : 'Citit';
  } else if (effective === 'DELIVERED') {
    glyph = '✓';
    color = '#32cd32';
    title = deliveredAt ? ('Livrat la ' + fmt(deliveredAt)) : 'Livrat';
  }

  return (
    <span style={{ fontSize: 11, color: color, fontWeight: 600, marginLeft: 4 }} title={title}>{glyph}</span>
  );
}

function fmt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

import React from 'react';

/**
 * Indica ce persoana scrie in chat
 * Afisata sub username in loc de "ultima accesare"
 */
export default function TypingIndicator({ typingUsers = [] }) {
  if (!typingUsers || typingUsers.length === 0) return null;

  const text = typingUsers.length === 1
    ? `${typingUsers[0]} scrie...`
    : `${typingUsers.join(', ')} scriu...`;

  return (
    <div style={styles.container}>
      <span style={styles.dots}>
        <span style={styles.dot} />
        <span style={styles.dot} />
        <span style={styles.dot} />
      </span>
      <span style={styles.text}>{text}</span>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  dots: {
    display: 'flex',
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    backgroundColor: '#999',
    animation: 'pulse 1.4s infinite',
  },
  text: {
    marginLeft: 4,
  },
  // Nota: Animation se va defini in CSS global
};

import React, { useState } from 'react';

/**
 * Selector pentru status predefinit sau custom
 * Statuses: In pauza, Medic, Nu deranjati, Intr-o sedinta, Online
 */
export default function StatusSelector({ onStatusChange, currentStatus }) {
  const [mode, setMode] = useState('predefined'); // 'predefined' sau 'custom'
  const [customText, setCustomText] = useState('');

  const predefinedStatuses = [
    { text: 'Online', type: 'ONLINE', color: '#22c55e' },
    { text: 'In pauza', type: 'AWAY', color: '#eab308' },
    { text: 'Nu deranjati', type: 'DND', color: '#ef4444' },
    { text: 'Intr-o sedinta', type: 'BUSY', color: '#f97316' },
    { text: 'La spital', type: 'CUSTOM', color: '#3b82f6' },
  ];

  // identifica varianta activa pe baza statusului curent salvat
  const isActive = (s) =>
    currentStatus &&
    currentStatus.statusType === s.type &&
    (currentStatus.statusText || '') === s.text;

  const handlePredefined = (status) => {
    if (onStatusChange) {
      onStatusChange(status.text, status.type);
    }
  };

  const handleCustom = () => {
    if (customText.trim() && onStatusChange) {
      onStatusChange(customText, 'CUSTOM');
      setCustomText('');
      setMode('predefined');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>Starea mea</div>

      {currentStatus && (
        <div style={styles.currentLine}>
          Acum: <strong>{currentStatus.statusText || currentStatus.statusType}</strong>
        </div>
      )}

      {/* Statuses predefinite */}
      <div style={styles.predefinedList}>
        {predefinedStatuses.map((status, idx) => {
          const active = isActive(status);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handlePredefined(status)}
              style={{
                ...styles.statusButton,
                borderColor: active ? status.color : 'var(--border, #e5e7eb)',
                color: active ? status.color : 'var(--text-dark, #374151)',
                background: active ? `${status.color}14` : '#fff',
                boxShadow: active ? `0 0 0 2px ${status.color}1f` : 'none',
              }}
            >
              <span style={{
                ...styles.dot,
                backgroundColor: status.color,
              }} />
              {status.text}
            </button>
          );
        })}
      </div>

      {/* Custom status */}
      <div style={styles.customSection}>
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCustom(); } }}
          placeholder="Scrie starea ta..."
          maxLength={50}
          style={styles.customInput}
        />
        <button
          type="button"
          onClick={handleCustom}
          disabled={!customText.trim()}
          style={{
            ...styles.customButton,
            opacity: customText.trim() ? 1 : 0.5,
          }}
        >
          Salveaza
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: 16,
    background: 'var(--bg-soft)',
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontWeight: 600,
    marginBottom: 6,
    fontSize: 14,
  },
  currentLine: {
    fontSize: 12,
    color: '#555',
    marginBottom: 10,
  },
  predefinedList: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 12,
  },
  statusButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    border: '1px solid',
    borderRadius: 10,
    background: '#ffffff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  customSection: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  customInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1.5px solid var(--border)',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'inherit',
  },
  customButton: {
    padding: '8px 16px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
};

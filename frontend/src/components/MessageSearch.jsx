import React, { useEffect, useState } from 'react';
import { searchInChat, searchInAllChats } from '../api/chats';

/**
 * Componenta pentru cautare mesaje in conversatii
 */
export default function MessageSearch({ chatId, onResults }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState('current'); // 'current' sau 'all'

  // Reseteaza rezultatele cand se schimba conversatia activa
  useEffect(() => {
    setQuery('');
    setResults([]);
  }, [chatId]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      let res;
      if (searchMode === 'current' && chatId) {
        res = await searchInChat(chatId, query);
      } else {
        res = await searchInAllChats(query);
      }
      setResults(res);
      if (onResults) onResults(res);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSearch} style={styles.form}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cauta mesaje..."
          style={styles.input}
        />
        
        {query && (
          <button
            type="button"
            onClick={handleClear}
            style={styles.clearBtn}
            title="Sterge cautarea"
          >
            ✕
          </button>
        )}

        <button
          type="submit"
          disabled={searching || !query.trim()}
          style={{
            ...styles.searchBtn,
            opacity: searching || !query.trim() ? 0.6 : 1,
          }}
        >
          {searching ? '...' : 'Caută'}
        </button>
      </form>

      {/* Mode selector - arata doar daca nu e in chat */}
      {!chatId && (
        <div style={styles.modeSelector}>
          <label style={styles.modeLabel}>
            <input
              type="radio"
              value="all"
              checked={searchMode === 'all'}
              onChange={(e) => setSearchMode(e.target.value)}
            />
            Toate conversatiile
          </label>
        </div>
      )}

      {/* Rezultate */}
      {results.length > 0 && (
        <div style={styles.results}>
          <div style={styles.resultCount}>{results.length} rezultate</div>
          <div style={styles.resultsList}>
            {results.map((msg) => (
              <div key={msg.id} style={styles.resultItem}>
                <div style={styles.senderName}>{msg.senderDisplayName || msg.senderUsername}</div>
                <div style={styles.messageText}>{msg.content}</div>
                <div style={styles.timestamp}>
                  {new Date(msg.createdAt).toLocaleString('ro-RO')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {searching && (
        <div style={styles.loading}>Se cauta...</div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 12,
    background: '#f9fafb',
    borderRadius: 8,
    marginBottom: 12,
    borderBottom: '1px solid #e5e7eb',
  },
  form: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1.5px solid var(--border)',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'inherit',
  },
  clearBtn: {
    padding: '8px 12px',
    background: '#fee2e2',
    color: '#991b1b',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  searchBtn: {
    padding: '8px 12px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  modeSelector: {
    fontSize: 12,
    marginBottom: 8,
    color: '#666',
  },
  modeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  results: {
    marginTop: 12,
  },
  resultCount: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: 600,
  },
  resultsList: {
    maxHeight: 300,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  resultItem: {
    padding: 8,
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: 12,
  },
  senderName: {
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: 4,
  },
  messageText: {
    color: '#4b5563',
    marginBottom: 4,
    wordBreak: 'break-word',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
  },
  loading: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
};

import React from 'react';

/**
 * Indicator vizual de status - bulina colorata cu tooltip
 * Colors: green (online), yellow (away), red (dnd), orange (busy), blue (custom)
 */
export default function StatusIndicator({ status, userOnline }) {
  if (!status) return null;

  const getStatusColor = (statusType) => {
    switch (statusType) {
      case 'ONLINE':
        return '#22c55e'; // green
      case 'AWAY':
        return '#eab308'; // yellow
      case 'DND':
        return '#ef4444'; // red
      case 'BUSY':
        return '#f97316'; // orange
      case 'CUSTOM':
        return '#3b82f6'; // blue
      default:
        return '#9ca3af'; // gray
    }
  };

  const color = getStatusColor(status.statusType);
  const tooltip = status.statusText || status.statusType;

  return (
    <div
      style={{
        ...styles.container,
        backgroundColor: color,
      }}
      title={tooltip}
    />
  );
}

const styles = {
  container: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: '2px solid white',
    display: 'inline-block',
  },
};

import React, { memo } from 'react';

/** avatar memorizat nu se re-randeaza daca src/name/size nu se schimba. */
const Avatar = memo(function Avatar({ src, name, size = 40 }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#b794f4', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, flexShrink: 0, fontSize: size * 0.4,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
});

export default Avatar;

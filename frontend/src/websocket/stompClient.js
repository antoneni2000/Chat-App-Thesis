import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/**
 * Wrapper peste @stomp/stompjs.
 *  - connect(token) — deschide conexiunea, trimite JWT-ul în header-ul CONNECT
 *  - subscribe(destination, callback) — primește mesaje pe un topic
 *  - publish(destination, body) — trimite mesaje către server
 *  - disconnect()
 */

let client = null;
let connectedPromise = null;

export function connect(token) {
  if (client && client.connected) {
    return Promise.resolve(client);
  }
  if (connectedPromise) {
    return connectedPromise;
  }

  client = new Client({
    // SockJS face fallback pentru browsere fără WebSocket nativ
    webSocketFactory: () => new SockJS('/ws'),
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    reconnectDelay: 5000,
    debug: () => {}, // silentios; pentru debug pune console.log
  });

  connectedPromise = new Promise((resolve, reject) => {
    client.onConnect = () => {
      console.log('WebSocket conectat');
      resolve(client);
    };
    client.onStompError = (frame) => {
      console.error('STOMP error:', frame);
      reject(new Error(frame.headers?.message || 'STOMP error'));
    };
    client.activate();
  });

  return connectedPromise;
}

export function subscribe(destination, callback) {
  if (!client || !client.connected) {
    console.warn('Subscribe: client not connected');
    return null;
  }
  return client.subscribe(destination, (msg) => {
    try {
      callback(JSON.parse(msg.body));
    } catch {
      callback(msg.body);
    }
  });
}

export function publish(destination, body) {
  if (!client || !client.connected) {
    console.warn('Publish: client not connected');
    return;
  }
  client.publish({ destination, body: JSON.stringify(body) });
}

export function disconnect() {
  if (client) {
    client.deactivate();
    client = null;
    connectedPromise = null;
  }
}

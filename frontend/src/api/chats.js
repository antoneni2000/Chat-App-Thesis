import client from './client';

// Wrapper peste axios pentru endpoint-urile de chat.
// fiecare functie returneaza Promise<data>.

export const listMyChats = () =>
  client.get('/chats').then((r) => r.data);

export const listAllUsers = () =>
  client.get('/users').then((r) => r.data);

export const createDirectChat = (otherUserId) =>
  client.post('/chats/direct', { otherUserId }).then((r) => r.data);

export const getChatMessages = (chatId) =>
  client.get(`/chats/${chatId}/messages`).then((r) => r.data);

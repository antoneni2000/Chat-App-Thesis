import client from './client';

export const listMyChats = () =>
  client.get('/chats').then((r) => r.data);

export const listAllUsers = () =>
  client.get('/users').then((r) => r.data);

export const createDirectChat = (otherUserId) =>
  client.post('/chats/direct', { otherUserId }).then((r) => r.data);

export const createGroup = (name, memberIds) =>
  client.post('/chats/groups', { name, memberIds }).then((r) => r.data);

export const getChatMessages = (chatId) =>
  client.get(`/chats/${chatId}/messages`).then((r) => r.data);

export const deleteChat = (chatId) =>
  client.delete(`/chats/${chatId}`).then((r) => r.data);

export const markChatAsRead = (chatId) =>
  client.post(`/chats/${chatId}/read`).then((r) => r.data);

export const sendMessage = (chatId, content, attachment) =>
  client.post(`/chats/${chatId}/messages`, {
    chatId,
    content,
    attachmentUrl: attachment?.url || null,
    attachmentName: attachment?.name || null,
    attachmentType: attachment?.type || null,
  }).then((r) => r.data);

export const updateMyProfile = (data) =>
  client.patch('/users/me', data).then((r) => r.data);

export const deleteMyAccount = () =>
  client.delete('/users/me').then((r) => r.data);

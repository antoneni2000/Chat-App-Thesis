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

/** uploadeaza fisier imagine ca avatar (multipart/form-data). returneaza UserDto. */
export const uploadAvatar = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return client.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

/** sterge avatarul curent. */
export const deleteAvatar = () =>
  client.delete('/users/me/avatar').then((r) => r.data);

export const deleteMyAccount = () =>
  client.delete('/users/me').then((r) => r.data);

// upload fisier la Google Cloud Storage prin backend
// returneaza { url, name, contentType, size }
export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return client.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

// === API calls noi pentru noi feature-uri ===

// status mg
export const setUserStatus = (statusText, statusType) =>
  client.post('/status/set', { statusText, statusType }).then((r) => r.data);

export const getMyStatus = () =>
  client.get('/status/me').then((r) => r.data);

export const getUserStatus = (userId) =>
  client.get(`/status/${userId}`).then((r) => r.data);

// cautare mesaje
export const searchInChat = (chatId, query) =>
  client.get('/messages/search', { params: { chatId, query } }).then((r) => r.data);

export const searchInAllChats = (query) =>
  client.get('/messages/search-all', { params: { query } }).then((r) => r.data);

// status livreare mesaj
export const markMessageAsRead = (messageId) =>
  client.post(`/messages/${messageId}/mark-read`).then((r) => r.data);

export const markMessageAsDelivered = (messageId) =>
  client.post(`/messages/${messageId}/mark-delivered`).then((r) => r.data);


import axios from 'axios';

// axios = libraria pentru cereri HTTP la backend.
// "instanță" = un client pre-configurat cu setări comune (baseURL, headers).
const client = axios.create({
  baseURL: '/api',  // toate cererile vor merge la /api/...; Vite face proxy către backend pe :8081
  headers: { 'Content-Type': 'application/json' },
});

// "interceptor" = funcție care rulează ÎNAINTEA fiecărei cereri.
// Aici atașăm automat header-ul Authorization dacă avem token salvat.
client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;

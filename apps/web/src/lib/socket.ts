import { io } from 'socket.io-client';

// Base URL: localhost uses API port directly, production uses same origin (nginx proxies /socket.io/)
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin);

// Connect to /ws namespace at the default socket.io transport path (/socket.io).
// nginx must proxy /socket.io/ → api:3000 with WebSocket upgrade headers.
export const socket = io(`${BASE_URL}/ws`, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: false,
});

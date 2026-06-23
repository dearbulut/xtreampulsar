import { io } from 'socket.io-client';

const SOCKET_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin);

export const socket = io(SOCKET_URL, {
  path: '/ws/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: false,
});

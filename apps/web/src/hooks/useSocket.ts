import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket';
import type { DashboardData } from '@/types';

export function useSocket() {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    socket.connect();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onDashboardUpdate = (data: DashboardData) => {
      qc.setQueryData(['analytics', 'dashboard'], data);
    };

    const onStreamStatus = () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
    };

    const onConnectionNew = () => {
      void qc.invalidateQueries({ queryKey: ['connections'] });
    };

    const onConnectionClose = () => {
      void qc.invalidateQueries({ queryKey: ['connections'] });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('dashboard:update', onDashboardUpdate);
    socket.on('stream:status', onStreamStatus);
    socket.on('connection:new', onConnectionNew);
    socket.on('connection:close', onConnectionClose);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('dashboard:update', onDashboardUpdate);
      socket.off('stream:status', onStreamStatus);
      socket.off('connection:new', onConnectionNew);
      socket.off('connection:close', onConnectionClose);
      socket.disconnect();
    };
  }, [qc]);

  return { connected };
}

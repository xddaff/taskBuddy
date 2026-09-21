'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

/// Opens one socket to the realtime service for as long as the component lives.
///
/// `withCredentials` is what makes this work at all: the realtime service reads
/// the same session cookie this app set, and the browser will not send it to
/// another port without being told to.
export function useSocket(url: string): { socket: Socket | null; status: SocketStatus } {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');

  useEffect(() => {
    const instance = io(url, { withCredentials: true });

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('offline');
    const onReconnectAttempt = () => setStatus('reconnecting');

    instance.on('connect', onConnect);
    instance.on('disconnect', onDisconnect);
    instance.io.on('reconnect_attempt', onReconnectAttempt);
    instance.io.on('error', onDisconnect);

    setSocket(instance);

    return () => {
      instance.off('connect', onConnect);
      instance.off('disconnect', onDisconnect);
      instance.io.off('reconnect_attempt', onReconnectAttempt);
      instance.io.off('error', onDisconnect);
      instance.disconnect();
      setSocket(null);
    };
  }, [url]);

  return { socket, status };
}

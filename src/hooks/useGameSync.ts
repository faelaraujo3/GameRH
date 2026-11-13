import { useEffect, useRef, useState, useCallback } from 'react';
import { PublicGameSnapshot } from '../shared/types';

export function useGameSync() {
  const [snapshot, setSnapshot] = useState<PublicGameSnapshot | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [displayRemainingSeconds, setDisplayRemainingSeconds] = useState<number>(45);

  const serverClockOffsetRef = useRef<number>(0);
  const snapshotRef = useRef<PublicGameSnapshot | null>(null);

  const applySnapshot = useCallback((data: PublicGameSnapshot) => {
    snapshotRef.current = data;
    serverClockOffsetRef.current = data.serverNow - Date.now();
    setSnapshot(data);

    if (data.status === 'ROUND_ACTIVE' && data.roundEndsAt) {
      const estimatedServerNow = Date.now() + serverClockOffsetRef.current;
      const remMs = Math.max(0, data.roundEndsAt - estimatedServerNow);
      setDisplayRemainingSeconds(Math.ceil(remMs / 1000));
    } else {
      setDisplayRemainingSeconds(Math.ceil(data.remainingMs / 1000));
    }
  }, []);

  const fetchLatestState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = (await res.json()) as PublicGameSnapshot;
        applySnapshot(data);
      }
    } catch {
      // Silencioso durante tentativa de reconexão
    }
  }, [applySnapshot]);

  useEffect(() => {
    fetchLatestState();

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    function connectWebSocket() {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isUnmounted) setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SNAPSHOT' && msg.data) {
            applySnapshot(msg.data);
          }
        } catch {
          // Ignorar erro de parse
        }
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          setConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 1500);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connectWebSocket();

    // Fallback de sincronização periódica caso a rede móvel oscile
    const pollInterval = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        fetchLatestState();
      }
    }, 2500);

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollInterval);
      ws?.close();
    };
  }, [applySnapshot, fetchLatestState]);

  // Cronômetro suave de alta precisão sincronizado com o relógio oficial do servidor
  useEffect(() => {
    const timer = setInterval(() => {
      const current = snapshotRef.current;
      if (!current) return;

      if (current.status === 'ROUND_ACTIVE' && current.roundEndsAt) {
        const estimatedServerNow = Date.now() + serverClockOffsetRef.current;
        const remMs = Math.max(0, current.roundEndsAt - estimatedServerNow);
        setDisplayRemainingSeconds(Math.ceil(remMs / 1000));
      } else {
        setDisplayRemainingSeconds(Math.ceil(current.remainingMs / 1000));
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  return {
    snapshot,
    connected,
    displayRemainingSeconds,
    applySnapshot,
    refreshState: fetchLatestState,
  };
}

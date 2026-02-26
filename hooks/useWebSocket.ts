"use client";

import { ConnectionState, WebSocketMessage } from "@/lib/websocket-types";
import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  url: string;
  enabled?: boolean;
  onMessage?: (message: WebSocketMessage | unknown) => void;
  onError?: (error: Event) => void;
  onUuidReceived?: (uuid: string) => void;
  /** Called when the socket re-opens after a disconnect (not on initial connect). */
  onReconnect?: () => void;
}

export function useWebSocket({
  url,
  enabled = true,
  onMessage,
  onError,
  onUuidReceived,
  onReconnect,
}: UseWebSocketOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [uuid, setUuid] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Reason: Deferred connection lets StrictMode cleanup cancel before the socket is created,
  // avoiding the "WebSocket is closed before the connection is established" browser warning.
  const connectDelayRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onUuidReceivedRef = useRef(onUuidReceived);
  const onReconnectRef = useRef(onReconnect);
  const isFirstMessageRef = useRef(true);
  const hasConnectedOnceRef = useRef(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
    onUuidReceivedRef.current = onUuidReceived;
    onReconnectRef.current = onReconnect;
  }, [onMessage, onError, onUuidReceived, onReconnect]);

  const openSocket = useCallback((targetUrl: string) => {
    try {
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState("connected");
        reconnectAttemptsRef.current = 0;
        isFirstMessageRef.current = true;
        if (hasConnectedOnceRef.current && onReconnectRef.current) {
          onReconnectRef.current();
        }
        hasConnectedOnceRef.current = true;
      };

      ws.onclose = () => {
        wsRef.current = null;
        setConnectionState("disconnected");

        if (reconnectAttemptsRef.current < 10) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 3000);

          reconnectTimeoutRef.current = setTimeout(() => {
            openSocket(targetUrl);
          }, delay);
        } else {
          setConnectionState("error");
        }
      };

      ws.onerror = (event: Event) => {
        if (onErrorRef.current) {
          onErrorRef.current(event);
        }
      };

      ws.onmessage = async (event: MessageEvent) => {
        try {
          let rawData: string;

          if (typeof event.data === 'string') {
            rawData = event.data;
          } else if (event.data instanceof Blob) {
            rawData = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            rawData = new TextDecoder().decode(event.data);
          } else {
            if (onMessageRef.current) {
              onMessageRef.current(event.data as WebSocketMessage);
            }
            return;
          }

          rawData = rawData.trim();

          if (isFirstMessageRef.current) {
            isFirstMessageRef.current = false;
            if (!rawData) {
              return;
            }
            const receivedUuid = rawData.trim();
            if (receivedUuid) {
              setUuid(receivedUuid);
              if (onUuidReceivedRef.current) {
                onUuidReceivedRef.current(receivedUuid);
              }
            }
            return;
          }

          if (!rawData) {
            return;
          }

          let message: WebSocketMessage = JSON.parse(rawData);

          if (typeof message === 'string') {
            message = JSON.parse(message);
          }

          if (onMessageRef.current) {
            onMessageRef.current(message);
          }
        } catch {
          /* malformed message — ignore */
        }
      };
    } catch {
      setConnectionState("error");
    }
  }, []);

  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (connectDelayRef.current) {
      clearTimeout(connectDelayRef.current);
      connectDelayRef.current = null;
    }

    if (!enabled) return;

    if (wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setConnectionState("connecting");

    connectDelayRef.current = setTimeout(() => {
      connectDelayRef.current = null;
      if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }
      openSocket(url);
    }, 80);
  }, [url, enabled, openSocket]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (connectDelayRef.current) {
      clearTimeout(connectDelayRef.current);
      connectDelayRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
    setConnectionState("disconnected");
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      if (connectDelayRef.current) {
        clearTimeout(connectDelayRef.current);
        connectDelayRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect, disconnect]);

  return { connectionState, uuid, disconnect };
}
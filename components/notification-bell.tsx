"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface Notification {
  id: string;
  type: "filled" | "cancelled" | "match" | "invited";
  message: string;
  timestamp: number;
  orderUuid?: string;
}

const STORAGE_KEY = "hodl-notifications";
const MAX_NOTIFICATIONS = 50;

function loadNotifications(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(items: Notification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  } catch { /* quota exceeded */ }
}

interface NotificationBellProps {
  notifications: Notification[];
  onClear: () => void;
  onDismiss: (id: string) => void;
}

export function NotificationBell({ notifications, onClear, onDismiss }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);

  const unreadCount = Math.max(0, notifications.length - seenCount);

  useEffect(() => {
    if (open) {
      setSeenCount(notifications.length);
    }
  }, [open, notifications.length]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 sm:h-9 sm:w-9 relative"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-1.5rem)] sm:w-80 max-w-80 bg-white dark:bg-background border-slate-200 dark:border-border/60 p-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-border/40">
          <h4 className="text-sm font-medium">Notifications</h4>
          {notifications.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-border/30 last:border-0 hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatRelativeTime(n.timestamp)}
                  </p>
                </div>
                <button
                  onClick={() => onDismiss(n.id)}
                  className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Hook to manage notification state with localStorage persistence.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      setNotifications(loadNotifications());
      initialized.current = true;
    }
  }, []);

  const addNotification = useCallback((n: Omit<Notification, "id" | "timestamp">) => {
    const newNotification: Notification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    setNotifications((prev) => {
      const next = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveNotifications(next);
      return next;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveNotifications(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  return { notifications, addNotification, dismiss, clearAll };
}

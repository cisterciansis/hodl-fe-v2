"use client";

import { OrderBook } from "../components/order-book";
import { Order } from "../lib/types";
import { useState, useCallback, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ThemeToggle } from "../components/theme-toggle";
import { useTheme } from "../components/theme-provider";
import { useWebSocket } from "../hooks/useWebSocket";
import { WebSocketMessage } from "../lib/websocket-types";
import { ConnectButton } from "../components/walletkit/connect";
import { WalletModal } from "../components/walletkit/wallet-modal";
import { NewOrderModal } from "../components/new-order-modal";
import { useWallet } from "../context/wallet-context";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { getWebSocketNewUrl, getWebSocketTapUrl, API_URL } from "../lib/config";
import { parseWsMessage } from "../lib/websocket-utils";
import { parseRecResponse, postJson, extractResponseError, buildRecPayload, fetchDbRecord } from "../lib/api-utils";
import { LoadingScreen } from "../components/loading-screen";
import { NotificationBell, useNotifications } from "../components/notification-bell";
import { PixelSymbolsBackground } from "../components/pixel-symbols-background";
import { useTMCSubnets } from "../hooks/useTMCSubnets";
import { useTaoPrice } from "../contexts/taoPrice";
import { useBlockHeight } from "../hooks/useBlockHeight";
import { MiniSpinner } from "../components/ui/mini-spinner";
import { RiBox3Line } from "react-icons/ri";
import { useWalletAutoReconnect } from "../hooks/useWalletAutoReconnect";
import { preWarmApi } from "../lib/bittensor";

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { selectedAccount, walletModalOpen, closeWalletModal } = useWallet();
  useWalletAutoReconnect();
  useTMCSubnets();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const { price: taoPrice, loading: taoPriceLoading } = useTaoPrice();
  const { height: blockHeight, loading: blockLoading } = useBlockHeight();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [newlyAddedOrderIds, setNewlyAddedOrderIds] = useState<
    Map<string, number>
  >(new Map());
  const [showMyOrdersOnly, setShowMyOrdersOnly] = useState(false);
  const [showWalletConnectDialog, setShowWalletConnectDialog] = useState(false);
  const [ofm, setOfm] = useState<[number, number, number]>([10, 0.01, 0.001]); // [open_max, open_min, fill_min]
  const [recPopupMessage, setRecPopupMessage] = useState<string>("");
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [myOrdersLoaded, setMyOrdersLoaded] = useState(false);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [filteredOrdersLoaded, setFilteredOrdersLoaded] = useState(false);
  const [filterAddress, setFilterAddress] = useState<string | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [subnetNames, setSubnetNames] = useState<Record<number, string>>({});
  const isLivePausedRef = useRef(false);
  const orderBufferRef = useRef<Order[]>([]);
  const { notifications, addNotification, dismiss: dismissNotification, clearAll: clearNotifications } = useNotifications();

  useEffect(() => {
    setMounted(true);
    preWarmApi();
  }, []);

  // Reason: Expose page header height as CSS variable so the order-book
  // card header can compute its own sticky offset dynamically.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--page-header-height", `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch OFM settings from backend
  useEffect(() => {
    const fetchOfm = async () => {
      try {
        const response = await fetch(`${API_URL}/ofm`);
        if (!response.ok) return;
        const data = await response.json();
        // Backend returns str([...]) so data is a string like "[10, 0.01, 0.001]"
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        if (Array.isArray(parsed) && parsed.length === 3) {
          setOfm([Number(parsed[0]), Number(parsed[1]), Number(parsed[2])]);
        }
      } catch (error) {
        console.error("Error fetching OFM settings:", error);
      }
    };
    fetchOfm();
  }, []);

  useEffect(() => {
    // Only reset filter if wallet disconnects while filter is active
    if (!selectedAccount && showMyOrdersOnly) {
      setShowMyOrdersOnly(false);
    }
  }, [selectedAccount, showMyOrdersOnly]);

  const handleMyOrdersClick = () => {
    if (!selectedAccount) {
      setShowWalletConnectDialog(true);
      return;
    }
    setShowMyOrdersOnly(!showMyOrdersOnly);
  };

  const handleLogoClick = () => {
    setShowMyOrdersOnly(false);
  };

  const isTerminalStatus = (status: number) => {
    return [3, 4, 6].includes(status);
  };

  const updateOrders = useCallback((updatedOrder: Order) => {
    if (isLivePausedRef.current) {
      orderBufferRef.current.push(updatedOrder);
      return;
    }
    setOrders((prevOrders) => {
      const sameStatusIndex = prevOrders.findIndex(
        (o) => o.uuid === updatedOrder.uuid && o.status === updatedOrder.status
      );

      if (sameStatusIndex !== -1) {
        const existingOrder = prevOrders[sameStatusIndex];
        const mergedOrder = {
          ...existingOrder,
          ...updatedOrder,
          tao: updatedOrder.tao > 0 ? updatedOrder.tao : existingOrder.tao,
          alpha: updatedOrder.alpha > 0 ? updatedOrder.alpha : existingOrder.alpha,
          price: updatedOrder.price > 0 ? updatedOrder.price : existingOrder.price,
        };

        const newOrders = [...prevOrders];
        newOrders[sameStatusIndex] = mergedOrder;
        return newOrders;
      }

      const sameUuidIndex = prevOrders.findIndex(
        (o) => o.uuid === updatedOrder.uuid
      );

      if (sameUuidIndex !== -1) {
        const existingOrder = prevOrders[sameUuidIndex];

        if (updatedOrder.status === 1 && existingOrder.status !== 1) {
          const orderId = `${updatedOrder.uuid}-${updatedOrder.status}-${updatedOrder.escrow || ""}`;
          setNewlyAddedOrderIds((prev) => {
            const next = new Map(prev);
            next.set(orderId, updatedOrder.type);
            return next;
          });

          setTimeout(() => {
            setNewlyAddedOrderIds((prev) => {
              const next = new Map(prev);
              next.delete(orderId);
              return next;
            });
          }, 3500);
        }

        const mergedOrder = {
          ...existingOrder,
          ...updatedOrder,
          tao: updatedOrder.tao > 0 ? updatedOrder.tao : existingOrder.tao,
          alpha: updatedOrder.alpha > 0 ? updatedOrder.alpha : existingOrder.alpha,
          price: updatedOrder.price > 0 ? updatedOrder.price : existingOrder.price,
        };

        const newOrders = [...prevOrders];
        newOrders[sameUuidIndex] = mergedOrder;
        return newOrders;
      }

      if (updatedOrder.status === 1) {
        const orderId = `${updatedOrder.uuid}-${updatedOrder.status}-${updatedOrder.escrow || ""}`;
        setNewlyAddedOrderIds((prev) => {
          const next = new Map(prev);
          next.set(orderId, updatedOrder.type);
          return next;
        });

        setTimeout(() => {
          setNewlyAddedOrderIds((prev) => {
            const next = new Map(prev);
            next.delete(orderId);
            return next;
          });
        }, 3500);
      }

      return [updatedOrder, ...prevOrders];
    });
  }, []);

  const handleLivePauseChange = useCallback((paused: boolean) => {
    isLivePausedRef.current = paused;
    if (!paused) {
      const buffered = [...orderBufferRef.current];
      orderBufferRef.current = [];
      for (const order of buffered) {
        updateOrders(order);
      }
    }
  }, [updateOrders]);

  const normalizeOrder = useCallback((order: any): Order => {
    return {
      ...order,
      accept: order.accept ?? "",
      period: Number(order.period || 0),
      partial:
        order.partial === "True" ||
        order.partial === true ||
        order.partial === 1,
      public:
        order.public === "True" || order.public === true || order.public === 1,
      status: Number(order.status),
      type: Number(order.type),
      asset: Number(order.asset),
      ask: Number(order.ask || 0),
      bid: Number(order.bid || 0),
      stp: Number(order.stp || 0),
      lmt: Number(order.lmt || 0),
      tao: Number(order.tao || 0),
      alpha: Number(order.alpha || 0),
      price: Number(order.price || 0),
    };
  }, []);

  /**
   * Merge an array of row-objects into state using a uuid-keyed Map so
   * duplicates are collapsed and terminal statuses are removed.
   */
  const mergeOrderBatch = useCallback((incoming: unknown[], shouldAnimateNewRows: boolean = false) => {
    if (incoming.length === 0) return;

    const newlyOpened = new Map<string, number>();
    setOrders((prev) => {
      const map = new Map(prev.map((o) => [o.uuid, o]));

      for (const raw of incoming) {
        if (!raw || typeof raw !== "object") continue;
        const normalized = normalizeOrder(raw);
        if (!normalized.uuid) continue;
        const existing = map.get(normalized.uuid);

        if (isTerminalStatus(normalized.status)) {
          map.delete(normalized.uuid);
        } else {
          // Reason: Skip incoming record if existing has a more terminal positive status,
          // preventing a stale status=1 row from overwriting a status=2 fill.
          if (existing) {
            if (normalized.status <= 0 && existing.status > 0) continue;
            if (normalized.status > 0 && existing.status > 0 && normalized.status < existing.status) continue;
          }
          if (
            shouldAnimateNewRows &&
            normalized.status === 1 &&
            (
              !existing ||
              existing.status !== 1 ||
              (existing.escrow || "") !== (normalized.escrow || "")
            )
          ) {
            const orderId = `${normalized.uuid}-${normalized.status}-${normalized.escrow || ""}`;
            newlyOpened.set(orderId, normalized.type);
          }
          map.set(normalized.uuid, normalized);
        }
      }

      return Array.from(map.values());
    });

    if (newlyOpened.size > 0) {
      const ids = Array.from(newlyOpened.keys());
      setNewlyAddedOrderIds((prev) => {
        const next = new Map(prev);
        newlyOpened.forEach((type, id) => {
          next.set(id, type);
        });
        return next;
      });

      setTimeout(() => {
        setNewlyAddedOrderIds((prev) => {
          const next = new Map(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }, 3500);
    }
  }, [normalizeOrder]);

  /**
   * Merge a batch into myOrders state. Unlike mergeOrderBatch, keeps terminal
   * statuses (filled/closed) since the My Orders view shows all statuses.
   * When multiple records share the same UUID (e.g. staging + final), the
   * record with the higher positive status wins to prevent a stale status=1
   * row from overwriting a status=2 fill.
   */
  const mergeMyOrderBatch = useCallback((incoming: unknown[]) => {
    if (incoming.length === 0) return;
    setMyOrders((prev) => {
      const map = new Map(prev.map((o) => [o.uuid, o]));
      for (const raw of incoming) {
        if (!raw || typeof raw !== "object") continue;
        const normalized = normalizeOrder(raw);
        if (!normalized.uuid) continue;
        const existing = map.get(normalized.uuid);
        if (existing) {
          // Reason: Backend batches can contain multiple rows per UUID (staging + final).
          // Skip incoming record if existing has a more terminal positive status.
          if (normalized.status <= 0 && existing.status > 0) continue;
          if (normalized.status > 0 && existing.status > 0 && normalized.status < existing.status) continue;
        }
        map.set(normalized.uuid, normalized);
      }
      return Array.from(map.values());
    });
  }, [normalizeOrder]);

  const updateMyOrder = useCallback((updatedOrder: Order) => {
    setMyOrders((prev) => {
      const idx = prev.findIndex((o) => o.uuid === updatedOrder.uuid);
      if (idx !== -1) {
        const existing = prev[idx];
        const merged = {
          ...existing,
          ...updatedOrder,
          tao: updatedOrder.tao > 0 ? updatedOrder.tao : existing.tao,
          alpha: updatedOrder.alpha > 0 ? updatedOrder.alpha : existing.alpha,
          price: updatedOrder.price > 0 ? updatedOrder.price : existing.price,
        };
        const next = [...prev];
        next[idx] = merged;
        return next;
      }
      return [updatedOrder, ...prev];
    });
  }, []);

  /**
   * Cross-stream sync: propagate filled/closed status from the My Orders
   * WS stream to the public `orders` state so the Order Book view doesn't
   * show stale "open" entries after a fill.
   */
  const syncToPublicOrders = useCallback((incoming: unknown[]) => {
    const updates: Order[] = [];
    for (const raw of incoming) {
      if (!raw || typeof raw !== "object") continue;
      const normalized = normalizeOrder(raw);
      if (normalized.uuid && (normalized.status === 2 || normalized.status === 3)) {
        updates.push(normalized);
      }
    }
    if (updates.length === 0) return;
    const updateMap = new Map(updates.map((o) => [o.uuid, o]));
    setOrders((prev) => {
      let changed = false;
      const next = prev.map((o) => {
        const update = updateMap.get(o.uuid);
        if (update && o.status !== update.status) {
          changed = true;
          return { ...o, ...update };
        }
        return o;
      });
      return changed ? next : prev;
    });
  }, [normalizeOrder]);

  /**
   * Converts a pandas column-oriented dict to a row-oriented array.
   * Input:  {"date": {"0": "...", "1": "..."}, "uuid": {"0": "a", "1": "b"}, ...}
   * Output: [{"date": "...", "uuid": "a", ...}, {"date": "...", "uuid": "b", ...}]
   */
  const columnsToRows = useCallback((colDict: Record<string, unknown>): Record<string, unknown>[] => {
    const columns = Object.keys(colDict);
    if (columns.length === 0) return [];

    const firstVal = colDict[columns[0]];
    if (!firstVal || typeof firstVal !== "object" || Array.isArray(firstVal)) return [];

    const indices = Object.keys(firstVal as Record<string, unknown>);
    if (indices.length === 0) return [];

    return indices.map((idx) => {
      const row: Record<string, unknown> = {};
      for (const col of columns) {
        row[col] = (colDict[col] as Record<string, unknown>)?.[idx];
      }
      return row;
    });
  }, []);

  /**
   * Handles all /ws/new message shapes:
   *  1. Raw array           — [{order}, ...]                      (records format)
   *  2. Column-oriented dict — {col: {idx: val, ...}, ...}        (pandas to_dict())
   *  3. Nested data          — {uuid, data: [...]} or {data: {order}}
   *  4. Flat order object    — {uuid, date, status, ...}          (single update)
   *  5. Empty dict           — {}                                 (no new orders)
   */
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage | unknown) => {
      if (!message || typeof message !== "object") return;

      // 1. Raw array (records format, or future backend update)
      if (Array.isArray(message)) {
        mergeOrderBatch(message, initialDataLoaded);
        if (!initialDataLoaded) setInitialDataLoaded(true);
        return;
      }

      const msg = message as Record<string, unknown>;
      const keys = Object.keys(msg);

      // 5. Empty dict — backend sends {} when no new orders; skip silently
      if (keys.length === 0) {
        if (!initialDataLoaded) setInitialDataLoaded(true);
        return;
      }

      // 2. Column-oriented pandas dict: values are {idx: val} objects, not scalars.
      //    Detect by checking if a known order field has an object value.
      const sampleKey = "uuid" in msg ? "uuid" : "date" in msg ? "date" : "";
      if (sampleKey) {
        const sample = msg[sampleKey];
        if (sample !== null && typeof sample === "object" && !Array.isArray(sample)) {
          const rows = columnsToRows(msg);
          mergeOrderBatch(rows, initialDataLoaded);
          if (!initialDataLoaded) setInitialDataLoaded(true);
          return;
        }
      }

      // 3. Nested {data: [...]} or {data: {order}}
      if ("data" in msg && msg.data !== undefined) {
        const payload = msg.data;
        if (Array.isArray(payload)) {
          mergeOrderBatch(payload, initialDataLoaded);
        } else if (payload && typeof payload === "object") {
          const normalized = normalizeOrder(payload);
          if (normalized.uuid) updateOrders(normalized);
        }
        if (!initialDataLoaded) setInitialDataLoaded(true);
        return;
      }

      // 4. Flat order object (scalar uuid + date)
      if ("uuid" in msg && "date" in msg) {
        const normalized = normalizeOrder(msg);
        if (normalized.uuid) updateOrders(normalized);
        if (!initialDataLoaded) setInitialDataLoaded(true);
        return;
      }

    },
    [mergeOrderBatch, columnsToRows, normalizeOrder, updateOrders, initialDataLoaded]
  );

  const { connectionState: publicConnectionState } = useWebSocket({
    url: getWebSocketNewUrl(),
    onMessage: handleWebSocketMessage,
  });

  useEffect(() => {
    if (initialDataLoaded || publicConnectionState !== "connected") return;
    const timer = setTimeout(() => setInitialDataLoaded(true), 3000);
    return () => clearTimeout(timer);
  }, [publicConnectionState, initialDataLoaded]);

  // --- My Orders WS: /ws/new?ss58=wallet ---
  const walletAddress = selectedAccount?.address;

  const handleMyOrdersWsMessage = useCallback(
    (message: WebSocketMessage | unknown) => {
      if (!message || typeof message !== "object") return;

      if (Array.isArray(message)) {
        mergeMyOrderBatch(message);
        syncToPublicOrders(message);
        if (!myOrdersLoaded) setMyOrdersLoaded(true);
        return;
      }

      const msg = message as Record<string, unknown>;
      const keys = Object.keys(msg);

      if (keys.length === 0) {
        if (!myOrdersLoaded) setMyOrdersLoaded(true);
        return;
      }

      const sampleKey = "uuid" in msg ? "uuid" : "date" in msg ? "date" : "";
      if (sampleKey) {
        const sample = msg[sampleKey];
        if (sample !== null && typeof sample === "object" && !Array.isArray(sample)) {
          const rows = columnsToRows(msg);
          mergeMyOrderBatch(rows);
          syncToPublicOrders(rows);
          if (!myOrdersLoaded) setMyOrdersLoaded(true);
          return;
        }
      }

      if ("data" in msg && msg.data !== undefined) {
        const payload = msg.data;
        if (Array.isArray(payload)) {
          mergeMyOrderBatch(payload);
          syncToPublicOrders(payload);
        } else if (payload && typeof payload === "object") {
          const normalized = normalizeOrder(payload);
          if (normalized.uuid) {
            updateMyOrder(normalized);
            if (normalized.status === 2 || normalized.status === 3) {
              syncToPublicOrders([payload]);
            }
          }
        }
        if (!myOrdersLoaded) setMyOrdersLoaded(true);
        return;
      }

      if ("uuid" in msg && "date" in msg) {
        const normalized = normalizeOrder(msg);
        if (normalized.uuid) {
          updateMyOrder(normalized);
          if (normalized.status === 2 || normalized.status === 3) {
            syncToPublicOrders([msg]);
          }
          if (normalized.status === 2) {
            addNotification({
              type: "filled",
              message: `Order ${normalized.uuid.slice(0, 8)}... has been filled`,
              orderUuid: normalized.uuid,
            });
          } else if (normalized.status === 3) {
            addNotification({
              type: "cancelled",
              message: `Order ${normalized.uuid.slice(0, 8)}... has been closed`,
              orderUuid: normalized.uuid,
            });
          }
        }
        if (!myOrdersLoaded) setMyOrdersLoaded(true);
        return;
      }
    },
    [mergeMyOrderBatch, syncToPublicOrders, columnsToRows, normalizeOrder, updateMyOrder, addNotification, myOrdersLoaded]
  );

  const { connectionState: myOrdersConnectionState } = useWebSocket({
    url: getWebSocketNewUrl({ ss58: walletAddress }),
    enabled: !!walletAddress,
    onMessage: handleMyOrdersWsMessage,
  });

  // Reset My Orders state when wallet changes or disconnects
  useEffect(() => {
    setMyOrders([]);
    setMyOrdersLoaded(false);
  }, [walletAddress]);

  useEffect(() => {
    if (myOrdersLoaded || myOrdersConnectionState !== "connected") return;
    const timer = setTimeout(() => setMyOrdersLoaded(true), 3000);
    return () => clearTimeout(timer);
  }, [myOrdersConnectionState, myOrdersLoaded]);

  // --- Filtered Orders WS: /ws/new?ss58=filterAddress ---
  // Reason: When the filter includes an ss58 address, we open a dedicated WS
  // to fetch ALL orders for that address (any status/privacy), instead of
  // client-side filtering the public stream which only has open+public orders.

  const mergeFilteredBatch = useCallback((incoming: unknown[]) => {
    if (incoming.length === 0) return;
    setFilteredOrders((prev) => {
      const map = new Map(prev.map((o) => [o.uuid, o]));
      for (const raw of incoming) {
        if (!raw || typeof raw !== "object") continue;
        const normalized = normalizeOrder(raw);
        if (!normalized.uuid) continue;
        const existing = map.get(normalized.uuid);
        if (existing) {
          if (normalized.status <= 0 && existing.status > 0) continue;
          if (normalized.status > 0 && existing.status > 0 && normalized.status < existing.status) continue;
        }
        map.set(normalized.uuid, normalized);
      }
      return Array.from(map.values());
    });
  }, [normalizeOrder]);

  const handleFilteredWsMessage = useCallback(
    (message: WebSocketMessage | unknown) => {
      if (!message || typeof message !== "object") return;

      if (Array.isArray(message)) {
        mergeFilteredBatch(message);
        if (!filteredOrdersLoaded) setFilteredOrdersLoaded(true);
        return;
      }

      const msg = message as Record<string, unknown>;
      const keys = Object.keys(msg);

      if (keys.length === 0) {
        if (!filteredOrdersLoaded) setFilteredOrdersLoaded(true);
        return;
      }

      const sampleKey = "uuid" in msg ? "uuid" : "date" in msg ? "date" : "";
      if (sampleKey) {
        const sample = msg[sampleKey];
        if (sample !== null && typeof sample === "object" && !Array.isArray(sample)) {
          const rows = columnsToRows(msg);
          mergeFilteredBatch(rows);
          if (!filteredOrdersLoaded) setFilteredOrdersLoaded(true);
          return;
        }
      }

      if ("data" in msg && msg.data !== undefined) {
        const payload = msg.data;
        if (Array.isArray(payload)) {
          mergeFilteredBatch(payload);
        } else if (payload && typeof payload === "object") {
          const normalized = normalizeOrder(payload);
          if (normalized.uuid) {
            setFilteredOrders((prev) => {
              const idx = prev.findIndex((o) => o.uuid === normalized.uuid);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = { ...prev[idx], ...normalized };
                return next;
              }
              return [normalized, ...prev];
            });
          }
        }
        if (!filteredOrdersLoaded) setFilteredOrdersLoaded(true);
        return;
      }

      if ("uuid" in msg && "date" in msg) {
        const normalized = normalizeOrder(msg);
        if (normalized.uuid) {
          setFilteredOrders((prev) => {
            const idx = prev.findIndex((o) => o.uuid === normalized.uuid);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = { ...prev[idx], ...normalized };
              return next;
            }
            return [normalized, ...prev];
          });
        }
        if (!filteredOrdersLoaded) setFilteredOrdersLoaded(true);
        return;
      }
    },
    [mergeFilteredBatch, columnsToRows, normalizeOrder, filteredOrdersLoaded]
  );

  const { connectionState: filteredConnectionState } = useWebSocket({
    url: getWebSocketNewUrl({ ss58: filterAddress || undefined }),
    enabled: !!filterAddress,
    onMessage: handleFilteredWsMessage,
  });

  // Reset filtered state when filterAddress changes
  useEffect(() => {
    setFilteredOrders([]);
    setFilteredOrdersLoaded(false);
  }, [filterAddress]);

  // /ws/tap - handles TAO/Alpha/Price triplet updates
  // Carries both per-escrow updates AND subnet price broadcasts
  const pendingPricesRef = useRef<Record<number, number>>({});
  const priceFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTapsRef = useRef<Map<string, { tao: number; alpha: number; price: number }>>(new Map());
  const tapFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPrices = useCallback(() => {
    const pending = pendingPricesRef.current;
    if (Object.keys(pending).length === 0) return;
    pendingPricesRef.current = {};
    setPrices((prev) => ({ ...prev, ...pending }));
  }, []);

  const flushTaps = useCallback(() => {
    const pending = new Map(pendingTapsRef.current);
    pendingTapsRef.current.clear();
    if (pending.size === 0) return;
    setOrders((prev) =>
      prev.map((order) => {
        if (order.status === 1 && order.escrow && pending.has(order.escrow)) {
          const update = pending.get(order.escrow)!;
          return { ...order, ...update };
        }
        return order;
      })
    );
  }, []);

  const handleTapMessage = useCallback((message: unknown) => {
    try {
      const tapData = parseWsMessage<Record<string, unknown>>(message);
      if (!tapData || typeof tapData !== "object") return;

      // Handle subnet price broadcasts: { price: { "0": 1.0, ... }, subnet_name: { ... } }
      const priceObj = tapData.price;
      if (priceObj && typeof priceObj === "object" && !Array.isArray(priceObj)) {
        for (const [key, value] of Object.entries(priceObj as Record<string, unknown>)) {
          const netuid = Number(key);
          const price = Number(value);
          if (!isNaN(netuid) && !isNaN(price) && price > 0) {
            pendingPricesRef.current[netuid] = price;
          }
        }
        if (!priceFlushTimerRef.current) {
          priceFlushTimerRef.current = setTimeout(() => {
            priceFlushTimerRef.current = null;
            flushPrices();
          }, 200);
        }
      }

      const nameObj = tapData.subnet_name;
      if (nameObj && typeof nameObj === "object" && !Array.isArray(nameObj)) {
        const next: Record<number, string> = {};
        for (const [key, value] of Object.entries(nameObj as Record<string, unknown>)) {
          const netuid = Number(key);
          if (!isNaN(netuid) && typeof value === "string") {
            next[netuid] = value;
          }
        }
        if (Object.keys(next).length > 0) {
          setSubnetNames((prev) => ({ ...prev, ...next }));
        }
      }

      // Handle per-escrow updates: { escrow, tao, alpha, price }
      if ("escrow" in tapData && tapData.escrow) {
        const escrow = String(tapData.escrow);
        pendingTapsRef.current.set(escrow, {
          tao: Number(tapData.tao || 0),
          alpha: Number(tapData.alpha || 0),
          price: Number(tapData.price || 0),
        });
        if (!tapFlushTimerRef.current) {
          tapFlushTimerRef.current = setTimeout(() => {
            tapFlushTimerRef.current = null;
            flushTaps();
          }, 200);
        }
      }
    } catch (error) {
      console.error("Error processing tap message:", error);
    }
  }, [flushPrices, flushTaps]);

  // --- My Orders TAP: /ws/tap?ss58=wallet ---
  const pendingMyTapsRef = useRef<Map<string, { tao: number; alpha: number; price: number }>>(new Map());
  const myTapFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushMyTaps = useCallback(() => {
    const pending = new Map(pendingMyTapsRef.current);
    pendingMyTapsRef.current.clear();
    if (pending.size === 0) return;
    setMyOrders((prev) =>
      prev.map((order) => {
        if (order.status === 1 && order.escrow && pending.has(order.escrow)) {
          const update = pending.get(order.escrow)!;
          return { ...order, ...update };
        }
        return order;
      })
    );
  }, []);

  const handleMyOrdersTapMessage = useCallback((message: unknown) => {
    try {
      const tapData = parseWsMessage<Record<string, unknown>>(message);
      if (!tapData || typeof tapData !== "object") return;

      // Subnet prices + names: update shared state from either TAP stream
      const priceObj = tapData.price;
      if (priceObj && typeof priceObj === "object" && !Array.isArray(priceObj)) {
        for (const [key, value] of Object.entries(priceObj as Record<string, unknown>)) {
          const netuid = Number(key);
          const price = Number(value);
          if (!isNaN(netuid) && !isNaN(price) && price > 0) {
            pendingPricesRef.current[netuid] = price;
          }
        }
        if (!priceFlushTimerRef.current) {
          priceFlushTimerRef.current = setTimeout(() => {
            priceFlushTimerRef.current = null;
            flushPrices();
          }, 200);
        }
      }

      if ("escrow" in tapData && tapData.escrow) {
        const escrow = String(tapData.escrow);
        pendingMyTapsRef.current.set(escrow, {
          tao: Number(tapData.tao || 0),
          alpha: Number(tapData.alpha || 0),
          price: Number(tapData.price || 0),
        });
        if (!myTapFlushTimerRef.current) {
          myTapFlushTimerRef.current = setTimeout(() => {
            myTapFlushTimerRef.current = null;
            flushMyTaps();
          }, 200);
        }
      }
    } catch (error) {
      console.error("Error processing my orders tap message:", error);
    }
  }, [flushPrices, flushMyTaps]);

  useEffect(() => {
    return () => {
      if (priceFlushTimerRef.current) clearTimeout(priceFlushTimerRef.current);
      if (tapFlushTimerRef.current) clearTimeout(tapFlushTimerRef.current);
      if (myTapFlushTimerRef.current) clearTimeout(myTapFlushTimerRef.current);
    };
  }, []);

  useWebSocket({
    url: getWebSocketTapUrl(),
    onMessage: handleTapMessage,
  });

  useWebSocket({
    url: getWebSocketTapUrl({ ss58: walletAddress }),
    enabled: !!walletAddress,
    onMessage: handleMyOrdersTapMessage,
  });

  // Fetch initial prices via REST
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch(`${API_URL}/price`);
        if (!response.ok) return;
        const data = await response.json();
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        if (parsed && typeof parsed === "object") {
          const priceMap: Record<number, number> = {};
          for (const [key, value] of Object.entries(parsed)) {
            const netuid = Number(key);
            const price = Number(value);
            if (!isNaN(netuid) && !isNaN(price) && price > 0) {
              priceMap[netuid] = price;
            }
          }
          if (Object.keys(priceMap).length > 0) {
            setPrices((prev) => ({ ...prev, ...priceMap }));
          }
        }
      } catch (error) {
        console.error("Error fetching initial prices:", error);
      }
    };
    fetchPrices();
  }, []);

  // Reason: /ws/new auto-populates open orders on first connect, so
  // initialDataLoaded is flipped to true on the first WS batch instead of
  // a separate /sql?limit=1000 REST call.

  // Reason: Support shareable order links (?order=UUID) for both public and private orders.
  // If the order is already in the book, just highlights it. Otherwise fetches and injects it.
  useEffect(() => {
    const orderUuid = searchParams.get("order");
    if (!orderUuid || !initialDataLoaded) return;

    const alreadyExists = orders.some((o) => o.uuid === orderUuid);
    if (alreadyExists) {
      setHighlightedOrderId(orderUuid);
      return;
    }

    const fetchSharedOrder = async () => {
      try {
        const response = await fetch(`${API_URL}/sql?uuid=${orderUuid}`);
        if (!response.ok) return;
        const data = await response.json();
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        const orderArr = Array.isArray(parsed) ? parsed : [parsed];
        for (const raw of orderArr) {
          if (raw && raw.uuid) {
            const normalized = normalizeOrder(raw);
            setOrders((prev) => {
              if (prev.some((o) => o.uuid === normalized.uuid && o.status === normalized.status)) return prev;
              return [normalized, ...prev];
            });
          }
        }
        setHighlightedOrderId(orderUuid);
      } catch (error) {
        console.error("Error fetching shared order:", error);
      }
    };
    fetchSharedOrder();
  }, [searchParams, initialDataLoaded, normalizeOrder, orders]);

  const handleUpdateOrder = async (uuid: string, updates: Partial<Order>) => {
    try {
      const sourceOrders = showMyOrdersOnly ? myOrders : orders;
      const order = sourceOrders.find((o) => o.uuid === uuid && o.status === 1);
      if (!order) return;

      const dbRecord = await fetchDbRecord(API_URL, order.escrow);
      const updatedOrderData = buildRecPayload({
        ...dbRecord,
        ...order,
        ...updates,
        uuid: order.uuid,
        status: 1,
      });

      const response = await postJson(`${API_URL}/rec`, updatedOrderData);

      if (!response.ok) {
        let errorMsg = "Failed to update order";
        try {
          const body = await response.text();
          if (body) errorMsg = body;
        } catch { /* use default */ }
        setRecPopupMessage(errorMsg);
        return;
      }

      try {
        const data = await response.json();
        const text = typeof data === "string" ? data : JSON.stringify(data);
        const recResult = parseRecResponse(text);
        if (recResult?.message) setRecPopupMessage(recResult.message);
      } catch { /* ignore */ }

      const applyUpdate = (prev: Order[]) =>
        prev.map((o) =>
          o.uuid === uuid && o.status === 1 ? { ...o, ...updates } : o
        );
      setOrders(applyUpdate);
      setMyOrders(applyUpdate);
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  const handleCancelOrder = async (uuid: string) => {
    try {
      const sourceOrders = showMyOrdersOnly ? myOrders : orders;
      const order = sourceOrders.find((o) => o.uuid === uuid && o.status === 1);
      if (!order) return;

      const dbRecord = await fetchDbRecord(API_URL, order.escrow);
      const closeOrderData = buildRecPayload({
        ...dbRecord,
        ...order,
        uuid: order.uuid,
        status: 3,
      });

      const response = await postJson(`${API_URL}/rec`, closeOrderData);

      if (!response.ok) {
        let errorMsg = "Failed to close order";
        try {
          const body = await response.text();
          if (body) errorMsg = body;
        } catch { /* use default */ }
        setRecPopupMessage(errorMsg);
        return;
      }

      try {
        const data = await response.json();
        const text = typeof data === "string" ? data : JSON.stringify(data);
        const recResult = parseRecResponse(text);
        if (recResult?.message) setRecPopupMessage(recResult.message);
      } catch { /* ignore */ }
    } catch (error) {
      console.error("Error closing order:", error);
    }
  };

  // Reason: Two separate memos for public vs. private data sources. The public
  // Order Book only shows open+public orders; My Orders shows all wallet orders.
  const { publicOpenOrders, publicFilledMap } = useMemo(() => {
    const open: Order[] = [];
    const filled: Record<string, Order[]> = {};

    orders.forEach((order) => {
      if (order.status === 1 && order.public === true) {
        open.push(order);
      } else if (order.status === 2 || order.status === 3) {
        const parentUuid = order.origin || order.uuid;
        if (!filled[parentUuid]) filled[parentUuid] = [];
        filled[parentUuid].push(order);
      }
    });

    Object.keys(filled).forEach((uuid) => {
      filled[uuid].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return { publicOpenOrders: open, publicFilledMap: filled };
  }, [orders]);

  const { myOpenOrders, myFilledMap } = useMemo(() => {
    const open: Order[] = [];
    const filled: Record<string, Order[]> = {};

    myOrders.forEach((order) => {
      if (order.status === 1) {
        open.push(order);
      } else if (order.status === 2 || order.status === 3) {
        const parentUuid = order.origin || order.uuid;
        if (!filled[parentUuid]) filled[parentUuid] = [];
        filled[parentUuid].push(order);
      }
    });

    Object.keys(filled).forEach((uuid) => {
      filled[uuid].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return { myOpenOrders: open, myFilledMap: filled };
  }, [myOrders]);

  const filteredFilledMap = useMemo(() => {
    const filled: Record<string, Order[]> = {};
    filteredOrders.forEach((order) => {
      if (order.status === 2 || order.status === 3) {
        const parentKey = order.origin || order.uuid;
        if (!filled[parentKey]) filled[parentKey] = [];
        filled[parentKey].push(order);
      }
    });
    Object.keys(filled).forEach((key) => {
      filled[key].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
    return filled;
  }, [filteredOrders]);

  const filledOrdersMap = showMyOrdersOnly
    ? myFilledMap
    : filterAddress
      ? filteredFilledMap
      : publicFilledMap;

  const sortedOrders = useMemo(() => {
    // My Orders: show all wallet orders (any status) from dedicated WS stream
    // Order Book: show only public open orders from public WS stream
    const source = showMyOrdersOnly ? myOrders : publicOpenOrders;

    const uniqueOrdersMap = new Map<string, Order>();
    source.forEach((order) => {
      const existing = uniqueOrdersMap.get(order.uuid);
      if (!existing) {
        uniqueOrdersMap.set(order.uuid, order);
      } else {
        const existingDate = new Date(existing.date).getTime();
        const currentDate = new Date(order.date).getTime();
        if (currentDate > existingDate) {
          uniqueOrdersMap.set(order.uuid, order);
        }
      }
    });

    return Array.from(uniqueOrdersMap.values()).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [myOrders, publicOpenOrders, showMyOrdersOnly]);

  return (
    <>
      {showLoading && (
        <LoadingScreen
          minDisplayTime={2400}
          isReady={initialDataLoaded && mounted}
          onComplete={() => setShowLoading(false)}
        />
      )}
    {/* 8-bit pixel symbols floating background */}
    <PixelSymbolsBackground />
    <main className="min-h-screen relative z-10">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl pt-2 sm:pt-4">
        <header ref={headerRef} className="mb-3 sm:mb-6 sticky top-0 z-50 bg-white/80 dark:bg-background/80 backdrop-blur-md">
          {/* Primary nav row */}
          <div className="flex items-center justify-between w-full pt-3 sm:pt-6 pb-2 sm:pb-3 gap-2">
            <div className="flex items-center gap-[2px] min-w-0">
              <button
                onClick={handleLogoClick}
                className="px-1 sm:px-1.5 pt-1.5 sm:pt-2 hover:opacity-80 transition-opacity cursor-pointer shrink-0"
                aria-label="Return to main page"
              >
                <Image
                  src="/hodl_logo_lg.png"
                  alt="HODL Exchange Logo"
                  width={50}
                  height={50}
                  className="object-contain w-9 h-9 sm:w-[50px] sm:h-[50px]"
                />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-[14px] sm:text-[18px] font-normal tracking-tight text-foreground font-[family-name:var(--font-pixel)]">
                    HODL<span className="ml-1 sm:ml-2">Exchange</span>
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href="https://github.com/mobiusfund/etf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#06F] dark:text-[#39F] text-[12px] sm:text-[15px] font-medium tracking-tight leading-[0.75rem] hover:opacity-80 transition-colors"
                  >
                    Powered by Subnet 118
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <ThemeToggle />
              <NotificationBell
                notifications={notifications}
                onClear={clearNotifications}
                onDismiss={dismissNotification}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleMyOrdersClick}
                className={`h-8 sm:h-9 gap-1.5 sm:gap-2 px-2 sm:px-3 ${showMyOrdersOnly
                  ? "bg-slate-100 dark:bg-muted border-slate-300 dark:border-border font-medium hover:bg-slate-200 dark:hover:bg-muted/80"
                  : ""
                  }`}
              >
                {mounted ? (
                  <Image
                    src={theme === "light" ? "/myorders-light.png" : "/myorders-black.png"}
                    alt="My Orders"
                    width={32}
                    height={32}
                    className="w-[1.125rem] h-[1.125rem] sm:w-[1.375rem] sm:h-[1.375rem]"
                  />
                ) : (
                  <Image
                    src="/myorders-light.png"
                    alt="My Orders"
                    width={32}
                    height={32}
                    className="w-[1.125rem] h-[1.125rem] sm:w-[1.375rem] sm:h-[1.375rem]"
                  />
                )}
                <span className="hidden sm:inline">My Orders</span>
              </Button>
              <ConnectButton />
            </div>
          </div>

          {/* Stats ticker strip */}
          <div className="flex items-center gap-3 sm:gap-6 pb-2 sm:pb-3 border-b border-slate-200 dark:border-border/40 overflow-x-auto scrollbar-hide">
            {/* TAO Price */}
            <a
              href="https://taomarketcap.com/subnets/0"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 shrink-0 hover:opacity-70 transition-opacity"
            >
              {taoPriceLoading ? (
                <>
                  <span className="text-[12px] font-mono font-medium tracking-tight text-foreground tabular-nums">τ</span>
                  <MiniSpinner size={12} className="text-muted-foreground" />
                </>
              ) : (
                <span className="text-[12px] font-mono font-medium tracking-tight text-foreground tabular-nums">
                  {taoPrice !== null
                    ? `τ $${taoPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "τ —"}
                </span>
              )}
            </a>

            {/* Separator */}
            <div className="w-px h-3 bg-border/60 shrink-0" />

            {/* Block Height */}
            <a
              href="https://taomarketcap.com/blockchain/blocks"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 shrink-0 hover:opacity-70 transition-opacity "
              aria-label="Block"
            >
              <RiBox3Line className="h-3.5 w-3.5 mb-[3px] shrink-0 text-muted-foreground" aria-hidden />
              {blockLoading ? (
                <MiniSpinner size={12} className="text-muted-foreground" />
              ) : (
                <span className="text-[12px] font-mono font-medium tracking-tight text-foreground tabular-nums">
                  {blockHeight !== null
                    ? `#${blockHeight.toLocaleString()}`
                    : "—"}
                </span>
              )}
            </a>

          </div>
        </header>

        <OrderBook
          orders={sortedOrders}
          prices={prices}
          filledOrdersMap={filledOrdersMap}
          newlyAddedOrderIds={newlyAddedOrderIds}
          allOrdersForSearch={showMyOrdersOnly ? myOrders : orders}
          onUpdateOrder={handleUpdateOrder}
          onCancelOrder={handleCancelOrder}
          onFillOrder={undefined}
          onRecMessage={setRecPopupMessage}
          onNewOrder={() => setNewOrderModalOpen(true)}
          apiUrl={API_URL}
          showMyOrdersOnly={showMyOrdersOnly}
          walletAddress={selectedAccount?.address}
          connectionState={showMyOrdersOnly ? myOrdersConnectionState : publicConnectionState}
          onPauseChange={handleLivePauseChange}
          subnetNames={subnetNames}
          ofm={ofm}
          highlightedOrderId={highlightedOrderId}
          onHighlightComplete={() => setHighlightedOrderId(null)}
          filterAddress={filterAddress}
          onFilterAddressChange={setFilterAddress}
          filteredOrders={filteredOrders}
          filteredFilledMap={filteredFilledMap}
          filteredConnectionState={filteredConnectionState}
        />

        <NewOrderModal
          open={newOrderModalOpen}
          onOpenChange={setNewOrderModalOpen}
          onRecMessage={setRecPopupMessage}
          apiUrl={API_URL}
          prices={prices}
          ofm={ofm}
          subnetNames={subnetNames}
        />

        <Dialog open={showWalletConnectDialog} onOpenChange={setShowWalletConnectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Wallet Required</DialogTitle>
              <DialogDescription>
                Please connect your wallet to view your orders. Click the Wallet button to connect.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => setShowWalletConnectDialog(false)}
                variant="outline"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <WalletModal open={walletModalOpen} onOpenChange={closeWalletModal} />

        {/* Standalone popup for /rec messages (e.g. status 3 / order closed) */}
        <Dialog open={!!recPopupMessage} onOpenChange={(open) => { if (!open) setRecPopupMessage(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Order Update</DialogTitle>
              <DialogDescription>{recPopupMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setRecPopupMessage("")} variant="outline">
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
    </>
  );
}


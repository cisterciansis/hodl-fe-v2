"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
  ExpandedState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableHead as TableHeadCell,
} from "@/components/ui/table";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "@/components/ui/button";
import { RiDiscordFill } from "react-icons/ri";
import { BsTwitterX } from "react-icons/bs";
import { PiGithubLogoFill } from "react-icons/pi";

import {
  Plus,
  Filter,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  X,
  ArrowUp,
  Columns2,
  List,
  CornerDownLeft,
  Wifi,
  WifiOff,
} from "lucide-react";
import { SplitBookView } from "./split-view";
import { formatTao, formatNumber, formatPrice } from "./columns";
import { Badge } from "@/components/ui/badge";
import { getOrderType, getOrderStatus, formatWalletAddress } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTMCSubnets } from "@/hooks/useTMCSubnets";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactElement;
  renderSplitSubComponent?: (order: TData) => React.ReactElement;
  onNewOrder?: () => void;
  newlyAddedOrderIds?: Map<string, number>;
  filledOrdersMap?: Record<string, TData[]>;
  allOrdersForSearch?: TData[];
  walletAddress?: string;
  showMyOrdersOnly?: boolean;
  connectionState?: "connected" | "connecting" | "disconnected" | "error";
  prices?: Record<number, number>;
  onPauseChange?: (paused: boolean) => void;
  subnetNames?: Record<number, string>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  renderSubComponent,
  renderSplitSubComponent,
  onNewOrder,
  newlyAddedOrderIds = new Map(),
  filledOrdersMap = {},
  allOrdersForSearch = [],
  walletAddress,
  showMyOrdersOnly = false,
  connectionState = "disconnected",
  prices = {},
  onPauseChange,
  subnetNames = {},
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [isLivePaused, setIsLivePaused] = React.useState(false);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  // Track expanded ids separately so filteredData doesn't depend on `expanded`
  const expandedIdsRef = React.useRef<Set<string>>(new Set());
  const [searchPopoverOpen, setSearchPopoverOpen] = React.useState(false);
  const [searchAddress, setSearchAddress] = React.useState<string>("");
  const [searchOrderType, setSearchOrderType] = React.useState<
    number | undefined
  >(undefined);
  const [subnetSearchText, setSubnetSearchText] = React.useState("");
  const subnetListRef = React.useRef<HTMLDivElement>(null);
  const [searchAssetIds, setSearchAssetIds] = React.useState<Set<number>>(new Set());
  const [isSearchActive, setIsSearchActive] = React.useState(false);
  const [showScrollToTop, setShowScrollToTop] = React.useState(false);
  const [isMobileView, setIsMobileView] = React.useState(false);
  const [isSplitView, setIsSplitView] = React.useState(false);
  const [splitExpandedRowId, setSplitExpandedRowId] = React.useState<string | null>(null);

  const { subnetNames: tmcSubnetNames } = useTMCSubnets();
  const filterSubnetOptions = React.useMemo(() => {
    const netuids = new Set<number>();
    Object.keys(prices).forEach((k) => {
      const n = Number(k);
      if (n > 0) netuids.add(n);
    });
    Object.keys(tmcSubnetNames).forEach((k) => {
      const n = Number(k);
      if (n > 0) netuids.add(n);
    });
    return Array.from(netuids)
      .sort((a, b) => a - b)
      .map((netuid) => ({
        netuid,
        name: tmcSubnetNames[netuid] || "",
      }));
  }, [prices, tmcSubnetNames]);

  // Reason: Split view has a known click bug (orders not clickable).
  // Keep it off by default — only enable when user explicitly toggles.
  React.useEffect(() => {
    const stored = typeof window !== "undefined" && localStorage.getItem("hodl-split-view");
    if (stored === "true") setIsSplitView(true);
  }, []);

  const toggleSplitView = React.useCallback(() => {
    setIsSplitView((prev) => {
      const next = !prev;
      localStorage.setItem("hodl-split-view", String(next));
      return next;
    });
    setSplitExpandedRowId(null);
  }, []);

  const cardHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const tableHeaderRef = React.useRef<HTMLTableSectionElement | null>(null);
  const headerScrollRef = React.useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setColumnFilters([{ id: "status", value: [0, 1] }]);
  }, []);

  React.useEffect(() => {
    if (isSearchActive) {
      setColumnFilters((prev) => prev.filter((filter) => filter.id !== "status"));
      // Collapse any expanded row when showing search results
      setExpanded({});
      expandedIdsRef.current = new Set();
    } else if (showMyOrdersOnly) {
      // My Orders: show all statuses (no status filter)
      setColumnFilters((prev) => prev.filter((filter) => filter.id !== "status"));
      setExpanded({});
      expandedIdsRef.current = new Set();
    } else {
      setColumnFilters((prev) => {
        const hasStatusFilter = prev.some((filter) => filter.id === "status");
        if (!hasStatusFilter) {
          return [...prev, { id: "status", value: [0, 1] }];
        }
        return prev.map((filter) =>
          filter.id === "status" ? { id: "status", value: [0, 1] } : filter
        );
      });
    }
  }, [isSearchActive, showMyOrdersOnly]);

  React.useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobileView();

    window.addEventListener("resize", checkMobileView);
    return () => window.removeEventListener("resize", checkMobileView);
  }, []);

  React.useLayoutEffect(() => {
    const setTopVar = () => {
      const cardHeaderHeight =
        cardHeaderRef.current?.getBoundingClientRect().height ?? 0;
      // Reason: Dynamically read page header height so the sticky offset
      // stays correct regardless of header content / viewport width.
      const pageHeader = document.querySelector("header");
      const pageHeaderHeight = pageHeader?.getBoundingClientRect().height ?? 114;
      const totalOffset = pageHeaderHeight + cardHeaderHeight;

      if (isMobileView && headerScrollRef.current) {
        headerScrollRef.current.style.top = `${totalOffset}px`;
      }
      if (!isMobileView && tableHeaderRef.current) {
        tableHeaderRef.current.style.top = `${totalOffset}px`;
      }
    };

    const timeoutId = setTimeout(setTopVar, 0);

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(setTopVar);
    });

    if (cardHeaderRef.current) {
      ro.observe(cardHeaderRef.current);
    }

    window.addEventListener("resize", setTopVar);
    window.addEventListener("scroll", setTopVar);

    return () => {
      clearTimeout(timeoutId);
      ro.disconnect();
      window.removeEventListener("resize", setTopVar);
      window.removeEventListener("scroll", setTopVar);
    };
  }, [isMobileView]);

  React.useEffect(() => {
    if (!isMobileView) return;

    const headerScroll = headerScrollRef.current;
    const bodyScroll = bodyScrollRef.current;

    if (!headerScroll || !bodyScroll) return;

    let isSyncing = false;

    const syncHeaderToBody = () => {
      if (isSyncing) return;
      isSyncing = true;
      headerScroll.scrollLeft = bodyScroll.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing = false;
      });
    };

    const syncBodyToHeader = () => {
      if (isSyncing) return;
      isSyncing = true;
      bodyScroll.scrollLeft = headerScroll.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing = false;
      });
    };

    bodyScroll.addEventListener("scroll", syncHeaderToBody);
    headerScroll.addEventListener("scroll", syncBodyToHeader);

    return () => {
      bodyScroll.removeEventListener("scroll", syncHeaderToBody);
      headerScroll.removeEventListener("scroll", syncBodyToHeader);
    };
  }, [isMobileView]);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 400;
      setShowScrollToTop(window.scrollY > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filteredData = React.useMemo(() => {
    if (isSearchActive) {
      const allFilledOrders = Object.values(filledOrdersMap).flat() as any[];
      const searchOrders = [
        ...(allOrdersForSearch.length > 0 ? allOrdersForSearch : data),
        ...allFilledOrders,
      ];

      const uniqueOrdersMap = new Map<string, any>();
      searchOrders.forEach((order: any) => {
        if (!order || !order.uuid) return;
        const key = `${order.uuid}-${order.status}-${order.escrow || ""}`;
        if (!uniqueOrdersMap.has(key)) {
          uniqueOrdersMap.set(key, order);
        }
      });
      const uniqueOrders = Array.from(uniqueOrdersMap.values());

      return uniqueOrders.filter((order: any) => {
        let addressMatch = true;
        if (searchAddress && searchAddress.trim() !== "") {
          const searchLower = searchAddress.toLowerCase().trim();
          const originMatch = order.origin
            ? String(order.origin).toLowerCase().includes(searchLower)
            : false;
          const escrowMatch = order.escrow
            ? String(order.escrow).toLowerCase().includes(searchLower)
            : false;
          const walletMatch = order.wallet
            ? String(order.wallet).toLowerCase().includes(searchLower)
            : false;
          addressMatch = originMatch || escrowMatch || walletMatch;
        }

        let orderTypeMatch = true;
        if (searchOrderType !== undefined && searchOrderType !== null) {
          orderTypeMatch = Number(order.type) === Number(searchOrderType);
        }

        let assetIdMatch = true;
        if (searchAssetIds.size > 0) {
          assetIdMatch = searchAssetIds.has(Number(order.asset));
        }

        const matches = addressMatch && orderTypeMatch && assetIdMatch;
        return matches;
      });
    }

    // My Orders: show all statuses (0, 1, 2, 3); column filter will restrict
    if (showMyOrdersOnly) {
      return data;
    }
    // Order Book: include rows that match open book OR are currently expanded
    const currentExpandedIds = expandedIdsRef.current;
    const filtered = data.filter((order: any) => {
      const orderId = `${order.uuid}-${order.status}-${order.escrow || ""}`;
      const matches = order.status === 1 && order.public === true;
      return matches || currentExpandedIds.has(orderId);
    });
    return filtered;
  }, [
    data,
    isSearchActive,
    showMyOrdersOnly,
    searchAddress,
    searchOrderType,
    searchAssetIds,
    filledOrdersMap,
    allOrdersForSearch,
  ]);


  // Wrap expand changes in startTransition so the click stays responsive
  const handleExpandedChange = React.useCallback((updater: React.SetStateAction<ExpandedState>) => {
    React.startTransition(() => {
      setExpanded(updater);
    });
  }, []);

  // Stable callback for row click — toggles one row, collapses others
  const handleRowClick = React.useCallback((rowId: string, isCurrentlyExpanded: boolean) => {
    const newExpanded: Record<string, boolean> = {};
    // Collapse all currently expanded
    expandedIdsRef.current.forEach((id) => {
      newExpanded[id] = false;
    });
    if (!isCurrentlyExpanded) {
      newExpanded[rowId] = true;
      expandedIdsRef.current = new Set([rowId]);
    } else {
      expandedIdsRef.current = new Set();
    }
    React.startTransition(() => {
      setExpanded(newExpanded);
    });
  }, []);

  const handleSubnetSearchInput = React.useCallback((text: string) => {
    const numericText = text.replace(/\D/g, "");
    setSubnetSearchText(numericText);

    if (numericText && subnetListRef.current) {
      requestAnimationFrame(() => {
        const firstMatch = subnetListRef.current?.querySelector(
          `[data-netuid-match="true"]`
        );
        firstMatch?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  }, []);

  const applySubnetSearch = React.useCallback(() => {
    const text = subnetSearchText.trim();
    if (!text) return;

    const parsed = parseInt(text);
    if (!isNaN(parsed) && parsed >= 0) {
      setSearchAssetIds((prev) => new Set(prev).add(parsed));
    }

    setSubnetSearchText("");
  }, [subnetSearchText]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row: any) => `${row.uuid}-${row.status}-${row.escrow || ""}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onSortingChange: (updater) => {
      setSorting(updater);
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      if (newSorting.length > 0 && !isLivePaused) {
        setIsLivePaused(true);
        onPauseChange?.(true);
      }
    },
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: handleExpandedChange,
    state: { sorting, columnFilters, expanded },
  });

  const rows = table.getRowModel().rows;
  return (
    <div className="w-full smooth-scroll">
      <Card className="w-full border-slate-200 dark:border-border/60 shadow-sm bg-white dark:bg-card/50 backdrop-blur-sm mb-3">
        <CardHeader
          ref={cardHeaderRef as any}
          className="sticky z-30 rounded-t-md bg-white dark:bg-background min-h-[60px] md:min-h-[93px] py-2 sm:px-6 px-3 border-b border-slate-200 dark:border-border/40 flex flex-row items-center justify-between"
          style={{ top: "var(--page-header-height, 114px)" }}
        >
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-start gap-1.5 sm:gap-2.5 min-w-0">
              <CardTitle className="text-[1.35rem] min-[400px]:text-[1.65rem] sm:text-[3.5rem] md:text-[4.25rem] font-normal tracking-wide leading-none text-foreground font-[family-name:var(--font-geist-pixel-circle)]">
                {isSearchActive ? "Filtered Orders" : showMyOrdersOnly ? "My Orders" : "Order Book"}
              </CardTitle>
              <button
                onClick={() => {
                  if (isLivePaused) {
                    setIsLivePaused(false);
                    onPauseChange?.(false);
                    setSorting([]);
                  }
                }}
                className={`group mt-2 inline-flex items-center gap-1 transition-all ${isLivePaused ? "cursor-pointer" : "cursor-default"
                  }`}
                title={
                  connectionState !== "connected"
                    ? connectionState === "connecting"
                      ? "Connecting to server..."
                      : "Disconnected from server"
                    : isLivePaused
                      ? "Click to resume live updates"
                      : "Streaming live"
                }
              >
                {connectionState === "connected" ? (
                  <Wifi
                    className={`h-4 w-4 transition-colors ${isLivePaused
                        ? "text-amber-500 group-hover:text-amber-400"
                        : "text-emerald-500 status-icon-live"
                      }`}
                  />
                ) : connectionState === "connecting" ? (
                  <Wifi className="h-4 w-4 text-amber-500 status-icon-connecting" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500/80" />
                )}
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider transition-colors ${connectionState === "connected"
                      ? isLivePaused
                        ? "text-amber-500 group-hover:text-amber-400"
                        : "text-emerald-500"
                      : connectionState === "connecting"
                        ? "text-amber-500/80"
                        : "text-red-500/70"
                    }`}
                >
                  {connectionState === "connected"
                    ? isLivePaused
                      ? "Paused"
                      : "Live"
                    : connectionState === "connecting"
                      ? "..."
                      : "Offline"}
                </span>
              </button>
            </div>

            <div className="flex flex-row items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
              {!isSearchActive && !showMyOrdersOnly && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 bg-white hover:bg-slate-50 border-slate-200 text-slate-600 dark:bg-background/80 dark:hover:bg-muted dark:border-border/60 dark:text-foreground"
                  onClick={toggleSplitView}
                  title={isSplitView ? "Unified view" : "Split view (Sell / Buy)"}
                >
                  {isSplitView ? <List className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
                </Button>
              )}
              <Popover
                open={searchPopoverOpen}
                onOpenChange={setSearchPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 bg-white hover:bg-slate-50 border-slate-200 text-slate-600 dark:bg-background/80 dark:hover:bg-muted dark:border-border/60 dark:text-foreground" title="Filter orders">
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[calc(100vw-1.5rem)] sm:w-[480px] max-w-[480px] bg-white dark:bg-background border-slate-200 dark:border-border/60"
                  align="end"
                  sideOffset={1}
                >
                  <div className="grid gap-4">
                    <div className="flex items-start justify-between pt-1">
                      <h4 className="font-medium leading-none">
                        Filter Order
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -mt-1 -mr-1"
                        onClick={() => setSearchPopoverOpen(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="search-address">
                          Wallet Address
                        </Label>
                        <Input
                          id="search-address"
                          type="text"
                          placeholder="Search by ss58 address"
                          value={searchAddress}
                          onChange={(e) => setSearchAddress(e.target.value)}
                          className="h-9 text-sm font-normal focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 bg-background placeholder:opacity-60 placeholder:text-muted-foreground"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Order Type</Label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSearchOrderType(searchOrderType === 2 ? undefined : 2)}
                            className={`flex-1 h-9 rounded-md border text-sm font-medium transition-all ${searchOrderType === 2
                                ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                                : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                              }`}
                          >
                            Buy
                          </button>
                          <button
                            type="button"
                            onClick={() => setSearchOrderType(searchOrderType === 1 ? undefined : 1)}
                            className={`flex-1 h-9 rounded-md border text-sm font-medium transition-all ${searchOrderType === 1
                                ? "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400"
                                : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                              }`}
                          >
                            Sell
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>Subnets (NETUID)</Label>
                        <div className="relative flex items-center">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Type NetUID and press Enter..."
                            value={subnetSearchText}
                            onChange={(e) => handleSubnetSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                applySubnetSearch();
                              }
                            }}
                            className="h-8 pr-8 text-sm font-normal focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 bg-background placeholder:opacity-60 placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          {subnetSearchText && (
                            <button
                              type="button"
                              onClick={applySubnetSearch}
                              className="absolute right-1.5 flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Apply (Enter)"
                            >
                              <CornerDownLeft className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div
                          ref={subnetListRef}
                          className="max-h-[180px] overflow-y-auto rounded-md border border-border bg-background p-2 grid grid-cols-1 min-[400px]:grid-cols-2 gap-1.5"
                        >
                          {filterSubnetOptions.map(({ netuid, name }) => {
                            const checked = searchAssetIds.has(netuid);
                            const isMatch =
                              subnetSearchText !== "" &&
                              String(netuid).startsWith(subnetSearchText);
                            return (
                              <label
                                key={netuid}
                                data-netuid-match={isMatch ? "true" : undefined}
                                className={`flex items-center gap-2 px-2 py-1 rounded-sm text-sm cursor-pointer transition-colors ${isMatch
                                    ? "bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300/60 dark:ring-blue-700/60"
                                    : "hover:bg-muted"
                                  }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    setSearchAssetIds((prev) => {
                                      const next = new Set(prev);
                                      if (c) next.add(netuid);
                                      else next.delete(netuid);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="font-mono text-xs">SN{netuid}</span>
                                <span className="text-muted-foreground text-xs truncate">{name || ""}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => {
                          setIsSearchActive(false);
                          setSearchAddress("");
                          setSearchOrderType(undefined);
                          setSubnetSearchText("");
                          setSearchAssetIds(new Set());
                          setSearchPopoverOpen(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsSearchActive(true);
                          setSearchPopoverOpen(false);
                        }}
                      >
                        Apply Filter
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {isSearchActive ? (
                <Button
                  onClick={() => {
                    setIsSearchActive(false);
                    setSearchAddress("");
                    setSearchOrderType(undefined);
                    setSubnetSearchText("");
                    setSearchAssetIds(new Set());
                  }}
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9 gap-1.5 sm:gap-2 px-2 sm:px-3"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden min-[400px]:inline">Back</span>
                </Button>
              ) : (
                onNewOrder && (
                  <Button
                    onClick={onNewOrder}
                    className="h-8 sm:h-9 gap-1.5 sm:gap-2 px-2.5 sm:px-3 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold shadow-[0_4px_14px_0_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_0_rgba(37,99,235,0.4)]"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden min-[400px]:inline">Open Order</span>
                  </Button>
                )
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isSplitView && !isSearchActive && !showMyOrdersOnly ? (
            <SplitBookView
              orders={filteredData as any}
              prices={prices}
              newlyAddedOrderIds={newlyAddedOrderIds}
              expandedRowId={splitExpandedRowId}
              onRowClick={(orderId) => {
                setSplitExpandedRowId((prev) => (prev === orderId ? null : orderId));
              }}
              renderSubComponent={renderSplitSubComponent as any}
            />
          ) : isMobileView ? (
            <div className="divide-y divide-slate-100 dark:divide-border/40">
              {rows.length ? (
                rows.map((row) => {
                  const order = row.original as any;
                  const orderType = getOrderType(order.type);
                  const statusText = getOrderStatus(order.status);
                  const isExpanded = row.getIsExpanded();
                  const taoValue = order.tao > 0 ? order.tao : order.bid;
                  const alphaValue = order.alpha > 0 ? order.alpha : order.ask;
                  const livePrice = prices[order.asset];
                  const displayPrice = order.price > 0
                    ? order.price
                    : (livePrice && livePrice > 0 ? livePrice : order.stp);
                  const flashClass = newlyAddedOrderIds.has(row.id)
                    ? newlyAddedOrderIds.get(row.id) === 2
                      ? "animate-flash-buy"
                      : "animate-flash-sell"
                    : "";

                  return (
                    <React.Fragment key={row.id}>
                      <div
                        className={`px-3 py-3 cursor-pointer active:bg-slate-100 dark:active:bg-muted/50 ${isExpanded ? "bg-slate-50 dark:bg-muted/30" : ""} ${flashClass}`}
                        onClick={() => handleRowClick(row.id, isExpanded)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={orderType === "Buy" ? "outline" : "secondary"}
                              className={`font-medium text-xs ${orderType === "Buy"
                                ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                                : "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400"
                              }`}
                            >
                              {orderType}
                            </Badge>
                            {order.asset > 0 && (
                              <span className="font-mono text-xs text-muted-foreground">SN{order.asset}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-medium text-xs">
                              {statusText}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">TAO</div>
                            <div className="font-mono tabular-nums text-foreground">{formatTao(taoValue || 0)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Alpha</div>
                            <div className="font-mono tabular-nums text-foreground">{formatNumber(alphaValue || 0)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="normal-case">α</span> Price</div>
                            <div className="font-mono tabular-nums text-foreground">{formatPrice(displayPrice || 0)}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[11px] text-muted-foreground font-mono">{formatWalletAddress(order.escrow)}</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>

                      {isExpanded && renderSubComponent && (
                        <div className="border-t border-slate-200 dark:border-border/40">
                          {renderSubComponent({ row })}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No results found.
                </div>
              )}
            </div>
          ) : (
            <Table noWrapper className="w-full table-fixed border-separate border-spacing-0 [&_tbody_td]:border-b [&_tbody_td]:border-slate-100 dark:[&_tbody_td]:border-border/40 [&_tbody_tr:last-child_td]:border-b-0">
              <TableHeader
                ref={tableHeaderRef as any}
                className="sticky z-40 bg-slate-50 dark:bg-background"
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHeadCell
                        key={header.id}
                        className="text-[0.75rem] font-semibold uppercase"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      </TableHeadCell>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <TableRow
                        data-state={row.getIsSelected() && "selected"}
                        data-expanded={row.getIsExpanded()}
                        className={`cursor-pointer ${newlyAddedOrderIds.has(row.id) ? "" : "transition-colors bg-white dark:bg-transparent"} data-[expanded=true]:bg-slate-50 dark:data-[expanded=true]:bg-muted/30 ${newlyAddedOrderIds.has(row.id)
                          ? newlyAddedOrderIds.get(row.id) === 2
                            ? "animate-flash-buy"
                            : "animate-flash-sell"
                          : ""
                          }`}
                        onClick={() => handleRowClick(row.id, row.getIsExpanded())}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>

                      {row.getIsExpanded() && renderSubComponent && (
                        <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                          <TableCell
                            colSpan={columns.length}
                            className="p-0 border-t-0"
                          >
                            {renderSubComponent({ row })}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-md bg-background dark:bg-background mb-6 sm:mb-12 text-[0.75rem] sm:text-[0.8125rem] px-1">
        <div className="text-muted-foreground">
          Showing {table.getRowModel().rows.length} rows
        </div>
        <div className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
          <a
            href="https://x.com/Subnet118"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-black dark:text-white hover:opacity-80 transition-opacity"
            aria-label="X (Twitter)"
          >
            <BsTwitterX className="h-[0.7rem] w-[0.7rem]" />
          </a>
          <span aria-hidden> </span>
          <a
            href="https://discord.gg/bittensor"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-black dark:text-white hover:opacity-80 transition-opacity"
            aria-label="Discord"
          >
            <RiDiscordFill className="h-[1rem] w-[1rem]" />
          </a>
          <span aria-hidden> </span>
          <a
            href="https://github.com/mobiusfund/etf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-black dark:text-white hover:opacity-80 transition-opacity"
            aria-label="GitHub"
          >
            <PiGithubLogoFill className="h-[1rem] w-[1rem]" />
          </a>
          <span aria-hidden> </span>
          <a
            href="https://subnet-118-dashboard.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center hover:opacity-80 transition-opacity mx-[-5px]"
            aria-label="Miners"
          >
            <img src="/pick_light.png" alt="" className="h-[1.25rem] w-[1.25rem] dark:hidden object-contain" />
            <img src="/pick_dark.png" alt="" className="h-[1.25rem] w-[1.25rem] hidden dark:block object-contain" />
          </a>
          <span aria-hidden> </span>
          <span className="text-[0.8125rem]">© Subnet 118</span>
        </div>
      </div>

      {showScrollToTop && (
        <Button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white hover:bg-slate-50 border-slate-200 text-slate-600 dark:bg-background/80 dark:hover:bg-muted dark:border-border/60 dark:text-foreground shadow-lg"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { Order, getOrderType, formatWalletAddress } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { formatDate, formatPrice, formatTao, formatNumber } from "./columns";

interface SplitBookViewProps {
  orders: Order[];
  prices: Record<number, number>;
  newlyAddedOrderIds: Map<string, number>;
  onRowClick?: (orderId: string) => void;
  expandedRowId?: string | null;
  renderSubComponent?: (order: Order) => React.ReactElement;
}

function CompactRow({
  order,
  prices,
  isNew,
  orderType,
  onClick,
  mirror,
  alignLeft,
}: {
  order: Order;
  prices: Record<number, number>;
  isNew: boolean;
  orderType: number;
  onClick: () => void;
  mirror?: boolean;
  alignLeft?: boolean;
}) {
  const price =
    order.price > 0
      ? order.price
      : prices[order.asset] > 0
        ? prices[order.asset]
        : order.stp || 0;

  const taoValue = order.type === 1 ? order.tao || order.bid : order.tao || order.bid;
  const alphaValue = order.type === 1 ? order.alpha || order.ask : order.alpha || order.ask;

  const alignClass = alignLeft ? "text-left" : "text-right";

  const cells = (
    <>
      <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono tabular-nums text-xs sm:text-sm ${alignClass}`}>
        {formatPrice(price)}
      </td>
      <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono tabular-nums text-xs sm:text-sm ${alignClass}`}>
        {formatTao(taoValue)}
      </td>
      <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono tabular-nums text-xs sm:text-sm ${alignClass}`}>
        {formatNumber(alphaValue)}
      </td>
      <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 ${alignClass}`}>
        <span className="font-mono text-[11px] sm:text-xs">SN{order.asset}</span>
      </td>
    </>
  );

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer text-sm transition-colors hover:bg-slate-50 dark:hover:bg-muted/40 ${isNew
        ? orderType === 2
          ? "animate-flash-buy"
          : "animate-flash-sell"
        : ""
        }`}
    >
      {mirror ? (
        <>
          <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 ${alignClass}`}>
            <span className="font-mono text-[11px] sm:text-xs">SN{order.asset}</span>
          </td>
          <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono tabular-nums text-xs sm:text-sm ${alignClass}`}>
            {formatNumber(alphaValue)}
          </td>
          <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono tabular-nums text-xs sm:text-sm ${alignClass}`}>
            {formatTao(taoValue)}
          </td>
          <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono tabular-nums text-xs sm:text-sm ${alignClass}`}>
            {formatPrice(price)}
          </td>
        </>
      ) : (
        cells
      )}
    </tr>
  );
}

/**
 * Split order book showing Bids and Asks side by side.
 * Bids sorted by price descending, Asks sorted by price ascending.
 */
export function SplitBookView({
  orders,
  prices,
  newlyAddedOrderIds,
  onRowClick,
  expandedRowId,
  renderSubComponent,
}: SplitBookViewProps) {
  const { bids, asks } = React.useMemo(() => {
    const bidOrders: Order[] = [];
    const askOrders: Order[] = [];
    for (const order of orders) {
      if (order.status !== 1 || !order.public) continue;
      if (order.type === 2) {
        bidOrders.push(order);
      } else if (order.type === 1) {
        askOrders.push(order);
      }
    }

    const getPrice = (o: Order) =>
      o.price > 0 ? o.price : prices[o.asset] > 0 ? prices[o.asset] : o.stp || 0;

    bidOrders.sort((a, b) => getPrice(b) - getPrice(a));
    askOrders.sort((a, b) => getPrice(a) - getPrice(b));

    return { bids: bidOrders, asks: askOrders };
  }, [orders, prices]);

  const expandedOrder = React.useMemo(() => {
    if (!expandedRowId) return null;
    return orders.find((o) => {
      const id = `${o.uuid}-${o.status}-${o.escrow || ""}`;
      return id === expandedRowId;
    }) ?? null;
  }, [expandedRowId, orders]);

  const headerCells = (
    <tr className="text-[0.6rem] sm:text-[0.7rem] font-semibold uppercase text-muted-foreground">
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right uppercase"><span className="normal-case">α</span> Price</th>
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right uppercase">TAO</th>
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right uppercase">Alpha</th>
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right uppercase">Asset</th>
    </tr>
  );

  const headerCellsMirror = (
    <tr className="text-[0.6rem] sm:text-[0.7rem] font-semibold uppercase text-muted-foreground">
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right uppercase">Asset</th>
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right uppercase">Alpha</th>
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right uppercase">TAO</th>
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right uppercase"><span className="normal-case">α</span> Price</th>
    </tr>
  );

  const headerCellsBuy = (
    <tr className="text-[0.6rem] sm:text-[0.7rem] font-semibold uppercase text-muted-foreground">
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left uppercase"><span className="normal-case">α</span> Price</th>
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left uppercase">TAO</th>
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left uppercase">Alpha</th>
      <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left uppercase">Asset</th>
    </tr>
  );

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0 bg-slate-200 dark:bg-border/40">
        {/* Sell (Asks) - mirror: price at center */}
        <div className="bg-white dark:bg-card/50 min-w-0">
          <div className="px-2.5 sm:px-4 py-1.5 sm:py-2 border-b justify-end border-slate-200 dark:border-border/40 flex items-center gap-2">
            <span className="text-[11px] sm:text-xs text-muted-foreground">{asks.length} orders</span>
            <Badge
              variant="outline"
              className="text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400 font-medium"
            >
              Sell
            </Badge>
          </div>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50 dark:bg-background z-10">
                {headerCellsMirror}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-border/30">
                {asks.length > 0 ? (
                  asks.map((order) => {
                    const orderId = `${order.uuid}-${order.status}-${order.escrow || ""}`;
                    return (
                      <CompactRow
                        key={orderId}
                        order={order}
                        prices={prices}
                        isNew={newlyAddedOrderIds.has(orderId)}
                        orderType={newlyAddedOrderIds.get(orderId) ?? order.type}
                        onClick={() => onRowClick?.(orderId)}
                        mirror
                      />
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                      No sell orders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Center spine: price column converges here */}
        <div className="hidden md:block w-px min-h-[300px] bg-slate-200 dark:bg-border/60 shrink-0" aria-hidden />

        {/* Buy (Bids) - price at center */}
        <div className="bg-white dark:bg-card/50 min-w-0">
          <div className="px-2.5 sm:px-4 py-1.5 sm:py-2 border-b border-slate-200 dark:border-border/40 flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400 font-medium"
            >
              Buy
            </Badge>
            <span className="text-[11px] sm:text-xs text-muted-foreground">{bids.length} orders</span>
          </div>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50 dark:bg-background z-10">
                {headerCellsBuy}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-border/30">
                {bids.length > 0 ? (
                  bids.map((order) => {
                    const orderId = `${order.uuid}-${order.status}-${order.escrow || ""}`;
                    return (
                      <CompactRow
                        key={orderId}
                        order={order}
                        prices={prices}
                        isNew={newlyAddedOrderIds.has(orderId)}
                        orderType={newlyAddedOrderIds.get(orderId) ?? order.type}
                        onClick={() => onRowClick?.(orderId)}
                        alignLeft
                      />
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                      No buy orders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Expanded row details */}
      {expandedOrder && renderSubComponent && (
        <div className="border-t border-slate-200 dark:border-border/40">
          {renderSubComponent(expandedOrder)}
        </div>
      )}
    </div>
  );
}

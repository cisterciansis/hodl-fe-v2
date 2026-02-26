export type OrderType = "Sell" | "Buy"
export type OrderStatus = "Init" | "Open" | "Filled" | "Error" | "Closed" | "Stopped" | "Expired"

export interface Order {
  uuid: string // Order UUID from backend (unique identifier)
  date: string // datetime UTC (ISO format)
  origin: string // ss58 address (order creator)
  escrow: string // ss58 address (escrow wallet for funds)
  wallet: string // ss58 address (user's wallet)
  accept: string // ss58 address (acceptance wallet)
  period: number // lock period
  asset: number // +n: netuid, -n: ts index
  type: number // 1: sell, 2: buy
  ask: number // ask price
  bid: number // bid price
  stp: number // stop price
  lmt: number // limit price
  gtd: string // good till datetime UTC
  partial: boolean // allow partial fills
  public: boolean // public order
  tao: number // TAO balance 
  alpha: number // Alpha balance 
  price: number // Price 
  status: number // -1: init, 1: open, 2: filled, 3: closed, 4: error, 5: stopped, 6: expired
}

export interface NewOrderFormData {
  type?: number // 1: sell, 2: buy
  alpha?: number // alpha amount (transfer amount for sell)
  tao?: number // tao amount (transfer amount for buy)
  asset?: number // subnet ID
  gtd: string // good till date (ISO string or "gtc")
  stp?: number // stop price
  partial: boolean // allow partial fills
  public: boolean // public order visibility
}

export const formatWalletAddress = (address: string) => {
  if (!address) return '—';
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export const getOrderType = (type: number): OrderType => {
  return type === 1 ? "Sell" : "Buy"
}

export const getOrderStatus = (status: number): OrderStatus => {
  switch (status) {
    case -1:
    case 0: return "Init"
    case 1: return "Open"
    case 2: return "Filled"
    case 3: return "Closed"
    case 4: return "Error"
    case 5: return "Stopped"
    case 6: return "Expired"
    default: return "Init"
  }
}

/**
 * Computes a display status for an order based on live market prices and current time.
 * Only overrides Open orders (status=1); all other statuses pass through unchanged.
 *
 * Priority: Expired (GTD breach) > Stopped (floor/ceiling breach) > Open.
 *
 * Args:
 *   order (Order): The order to evaluate.
 *   prices (Record<number, number>): Live TAP market prices keyed by netuid.
 *
 * Returns:
 *   { status: number; text: OrderStatus }: The computed display status.
 */
export function getDisplayStatus(
  order: Order,
  prices: Record<number, number>
): { status: number; text: OrderStatus } {
  if (order.status !== 1) {
    return { status: order.status, text: getOrderStatus(order.status) };
  }

  // Expired: GTD is set and current UTC time >= GTD
  if (order.gtd && order.gtd !== '') {
    const gtdDate = new Date(order.gtd.endsWith('Z') ? order.gtd : order.gtd + 'Z');
    if (!isNaN(gtdDate.getTime()) && new Date() >= gtdDate) {
      return { status: 6, text: "Expired" };
    }
  }

  // Stopped: stop price is set and market price triggers it
  if (order.stp > 0) {
    const marketPrice = prices[order.asset] ?? 0;
    if (marketPrice > 0) {
      // Sell order: stopped when market at or below floor
      if (order.type === 1 && marketPrice <= order.stp) {
        return { status: 5, text: "Stopped" };
      }
      // Buy order: stopped when market at or above ceiling
      if (order.type === 2 && marketPrice >= order.stp) {
        return { status: 5, text: "Stopped" };
      }
    }
  }

  return { status: 1, text: "Open" };
}

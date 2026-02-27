# HODL Exchange - Task Tracker

## Completed Tasks

### 2026-02-22 — Frontend Overhaul

#### Critical Bug Fixes
- [x] **Loading screen freeze** — Added `pointer-events-none` during fade-out and 8s safety timeout so UI is never blocked
- [x] **Search cancel crash** — Cancel button now resets `isSearchActive` along with filter state; added null guards in `filteredData`
- [x] **Subnet link routing** — Changed all subnet links from `taostats.io` to `taomarketcap.com/subnets/{asset}`

#### High Priority
- [x] **WebSocket endpoint migration** — `/ws/book` renamed to `/ws/new`; `/ws/price` deprecated and removed; price data now via REST `/price` (initial) + `/ws/tap` (live)
- [x] **Hide Modify/Cancel for non-owners** — Buttons completely hidden (not just disabled) when connected wallet doesn't own the order
- [x] **Rename Search → Filter** — "Search Order" renamed to "Filter Order" with filter icon throughout the UI
- [x] **Split order book view** — New Bids/Asks side-by-side view with toggle button; persisted in localStorage

#### Medium Priority
- [x] **Live badge** — Green pulsing "Live" indicator on order book; pauses on sort with amber "Paused" state; click to resume with buffered order flush
- [x] **Filter enhancements** — Neutral Buy/Sell toggle buttons; multi-NetUID checkbox selection with subnet names; manual NetUID input preserved
- [x] **Private order shareable links** — `?order=UUID` query param support to view/share private orders
- [x] **Notification bell** — Bell icon in header with unread badge; notifications for order filled/cancelled; localStorage persistence
- [x] **My Orders live streaming** — Verified: real-time updates flow through shared state to My Orders view
- [x] **Logo quality** — Replaced low-res PNG with crisp SVG vector logo component (`HodlLogo`)

- [x] **NetUID search auto-toggle** — Typing in the NetUID search input auto-checks matching subnets in the checkbox list (prefix match), scrolls to first match, highlights matched items with blue ring

### 2026-02-23 — Frontend/Backend Alignment

#### Critical — Payload & UUID
- [x] **Schema alignment** — Added `accept` (TEXT) and `period` (BIGINT) fields to `Order` interface and all `/rec` payloads
- [x] **Canonical field order** — All payloads now built via `buildRecPayload()` in `lib/api-utils.ts` with consistent field order and N/A defaults (text→`''`, numbers→`0`)
- [x] **UUID lifecycle hardening** — Added `onReconnect` callback to `useWebSocket`; modals detect mid-flow reconnections, warn user, and reset escrow state; connecting state UI shows while awaiting UUID

#### High Priority
- [x] **Logo upgrade** — Loading screen and header now use `hodl_logo_lg.png` (HD)
- [x] **Price label rename** — "Price" column/labels renamed to "α Price" across order book, split view, and fill modal
- [x] **Wallet reliability** — Ported TrustedStake patterns: signer refresh with retry + exponential backoff, visibility change handler, auto-reconnect hook (`useWalletAutoReconnect`), improved wallet modal error UI with retry button
- [x] **OFM validation** — Client-side order size guardrails: max/min for open orders, min for fills; `ofm` prop threaded from page → OrderBook → row-details → FillOrderModal

#### Medium Priority
- [x] **Live badge ripple** — Added broadcast ripple animation ring around the live wifi icon
- [x] **Modal declutter** — Moved GTC explanation and partial-fills explanation from inline text to info bubble tooltips
- [x] **Deprecated cleanup** — Removed `getWebSocketPriceUrl` from `lib/config.ts`
- [x] **Stop price tooltip** — Verified tooltip text accuracy against backend `execute.py` logic; no change needed
- [x] **Split view default** — Confirmed split view defaults to off (known click bug documented)

### 2026-02-24 — Form Submission Refactor & UI Polish

#### UI Improvements
- [x] **Order Size unit indicator** — Shows τ or α suffix inside the Order Size input once user enters an amount (both Open Order and Fill Order modals)
- [x] **α Price label fix** — Wrapped α character in `normal-case` span across fill modal, split view headers, and sortable column header so it renders as lowercase alpha instead of uppercase A

#### Critical — Payload Refactor
- [x] **`/dbjson` fetch-before-submit** — All form submissions now fetch current DB record from `/dbjson` before submitting, merge user inputs over DB defaults, and leave unmodified fields at their DB values. Added `fetchDbRecord()` helper in `lib/api-utils.ts`. Refactored 4 submission paths (8 total stages):
  - Open Order: stage 1 (status=-1) + stage 2 (status=1) + review (status=-1)
  - Fill Order: stage 1 (status=-1) + stage 2 (status=2) + review (status=-1)
  - Modify button: single stage (status=1) — now uses `{...dbRecord, ...updates, status: 1}`
  - Close Order button: single stage (status=3) — now uses `{...dbRecord, status: 3}`

### 2026-02-24 — Mobile UI Optimization

#### Completed
- [x] **Dialog base component** — Added `max-h-[90dvh] overflow-y-auto`, responsive `w-[calc(100vw-2rem)]`, and tighter padding on mobile
- [x] **Page header responsive** — Compact spacing, smaller logo/title on mobile, tighter button gaps, responsive stats ticker
- [x] **Order book card header** — Replaced fixed `h-[93.07px]` with responsive `min-h`, title scales from `2rem` to `4.25rem`, action buttons wrap properly
- [x] **Mobile order cards** — Replaced `min-w-[1200px]` horizontal-scroll table with tappable card layout on `< 768px`, showing Buy/Sell badge, TAO, Alpha, Price, Status
- [x] **Filter popover** — Full-width on mobile `w-[calc(100vw-1.5rem)]`, single-column subnet grid on very small screens
- [x] **Row details responsive** — Tighter padding, smaller buttons, filled orders use card layout on mobile instead of fixed-width table
- [x] **Split view mobile** — Tighter cell padding and font sizes on small screens
- [x] **Modals (open/fill order)** — Added `max-h-[90dvh] overflow-y-auto`, consistent full-width on mobile
- [x] **Notification bell** — Responsive popover width `w-[calc(100vw-1.5rem)] sm:w-80`
- [x] **Loading screen** — Scaled down logo, progress bar, and text for mobile
- [x] **Scroll-to-top button** — Repositioned to `bottom-4 right-4` on mobile with smaller touch target
- [x] **Footer** — Tighter bottom margin and font size on mobile
- [x] **Mobile breakpoint** — Aligned `isMobileView` from 968px to 768px (Tailwind `md:` breakpoint)

### 2026-02-25 — Order Creation Bug Fixes & Validation

#### Critical Bug Fix
- [x] **Stage 2 payload missing formData fields** — `handleFinalPlaceOrder()` was not including `asset`, `type`, `stp`, `gtd`, `partial`, `public` from formData in the `buildRecPayload` call. The BE `/dbjson` endpoint returns template defaults (asset=0, type=0) regardless of escrow param, so these fields were sent as 0/empty, causing orphaned escrows. Fixed by explicitly including all formData fields matching `handleNext()` and `handleReviewOrder()`.

#### UI/UX Improvements
- [x] **Rename Stop Price to Floor/Ceiling Price** — Label changed from "Stop Price (TAO)" to "Floor/Ceiling Price" with updated tooltip explaining sell floor and buy ceiling behavior.
- [x] **Block past dates in GTD calendar** — Calendar now disables dates before today to prevent users from creating orders with expired good-till-dates. BE already rejects these but FE now prevents it upfront.
- [x] **Floor/Ceiling price vs market warnings** — Added inline amber warnings: sell orders with floor price above market, buy orders with ceiling price below market. These are warnings (not blockers) since market prices change.
- [x] **Fill order stage 2 payload missing fields** — Same `/dbjson` template-default bug in `fill-order-modal.tsx` `handleFillOrder()`. Added `asset`, `type`, `ask`, `bid`, `stp`, `lmt`, `gtd`, `partial`, `public` from `fixedValues`/`order` to match stage 1 and review paths.
- [x] **Modify/Close order payloads missing fields** — `page.tsx` `handleUpdateOrder()` and `handleCancelOrder()` only spread `dbRecord` (template defaults). Added `...order` spread so all existing order fields (asset, type, wallet, origin, escrow, etc.) are preserved before applying updates.
- [x] **WebSocket connections verified** — `/ws/new?ss58=wallet` and `/ws/tap?ss58=wallet` patterns confirmed correct against BE codebase.

### 2026-02-25 — Data Flow Optimization

#### Completed
- [x] **Remove initial /sql?limit=1000 fetch** — `/ws/new` now auto-populates open orders on first connect. Removed the REST call and refactored `handleWebSocketMessage` to handle all `/ws/new` message shapes:
  - Column-oriented pandas dict (`df.to_dict()` format) — pivoted to rows via `columnsToRows()`
  - Raw array (records format, future-proof)
  - Nested `{data: [...]}` wrapper
  - Flat single-order objects
  - Empty `{}` (no new orders this cycle)
  `initialDataLoaded` is set on the first WS message of any kind. Added 3s safety fallback after WS connects. Saves one HTTP round-trip per page load.

### 2026-02-25 — Order Book New-Row Flash Polish

#### Completed
- [x] **Restore new-row buy/sell flash after batch WS merge** — Added new-open-order detection in `mergeOrderBatch()` so rows arriving via array/column-oriented `/ws/new` payloads are flagged in `newlyAddedOrderIds` (excluding initial hydration), then auto-cleared after animation window.
- [x] **Subtle buy/sell row animation palette** — Reworked `animate-flash-buy` / `animate-flash-sell` keyframes to use softer translucent emerald/rose overlays and gentle outline glow to match the New Order / Fill Order visual style.

### 2026-02-25 — Order Book UI Fix

#### Completed
- [x] **Filled orders vertical misalignment** — Expanded row details' filled orders table had no column width definitions, causing columns to misalign with the parent order book table. Fixed by applying `table-fixed` with a `<colgroup>` matching the parent column sizes (160, 110, 60, 50, 70, 70, 90, 90), negative margins to cancel parent padding, and matching cell padding/alignment.

### 2026-02-25 — Wallet Refresh & Modal UX Optimization

#### Completed
- [x] **Pre-warm Bittensor API** — `preWarmApi()` called on mount in `page.tsx`; `getApi()` disconnect handler auto-reconnects after 2s so the chain API is always warm (eliminates 5-30s cold start on transfers)
- [x] **Streamline wallet auto-reconnect** — `useWalletAutoReconnect` now calls `refreshSigner()` directly instead of dispatching a fake `visibilitychange` event; exposes `isRefreshingSigner` state for UI
- [x] **Speed up `refreshSigner`** — Single attempt with 3s timeout (was 3 retries x 10s timeout + exponential backoff, up to ~37s worst case); fast-path returns immediately if cached extension still has valid signer
- [x] **Remove blocking "Connecting to server..." banners** — Removed the amber/blue blocking banners from both `fill-order-modal` and `new-order-modal`. The per-modal WebSocket connects silently in the background while the user fills the form. The "Create Escrow" button is disabled until the WS UUID is available (subtle guard instead of blocking banner).
- [x] **Faster WS reconnection** — Changed `useWebSocket` backoff from `2^n` capped at 30s (2s/4s/8s/16s/30s) to `1.5^n` capped at 3s (~1.5s/2.3s/3s/3s/3s) for much faster reconnection on modal connections.

### 2026-02-25 — WebSocket Connection UX & CORS Proxy

#### Completed
- [x] **StrictMode WebSocket churn fix** — Added 80ms deferred connection in `useWebSocket` so React StrictMode's mount/unmount/remount cycle cancels the first connection attempt before the socket is created, eliminating the "WebSocket is closed before the connection is established" console spam in development.
- [x] **"Connecting..." button indicator** — Both `fill-order-modal` and `new-order-modal` now show a spinner + "Connecting..." on the Create Escrow button while waiting for the WebSocket UUID. Shows "Connection Failed" when the WS enters error state. Previously the button was silently disabled with no feedback.
- [x] **Expose connectionState to modals** — `useWebSocket` return value (`connectionState`) is now captured in both modals to drive button label/state.
- [x] **Next.js rewrite proxy for all HTTP API calls** — Added `rewrites()` in `next.config.js` routing `/api/backend/:path*` → `https://api.subnet118.com/:path*`. All HTTP requests (`/rec`, `/price`, `/dbjson`, `/ofm`, `/sql`, `/stake/*`) now go through the same-origin proxy, eliminating CORS blocks when running localhost against the production API. WebSocket connections remain direct (not subject to CORS). `API_URL` changed from direct URL to `/api/backend`. Removed obsolete `app/api/orders/route.ts` single-endpoint proxy.

### 2026-02-25 — Dual WebSocket Stream Separation

#### Completed
- [x] **Separate Order Book and My Orders WS streams** — Previously a single `/ws/new` connection served both views, and My Orders just filtered the public data (private orders never showed). Now two independent streams run concurrently:
  - `/ws/new` (always on) → public Order Book: open + public orders
  - `/ws/new?ss58=wallet` (when wallet connected) → My Orders: all wallet orders (public, private, open, filled, closed)
- [x] **Separate TAP streams** — Matching dual TAP connections:
  - `/ws/tap` → per-escrow updates for public orders + subnet price broadcasts
  - `/ws/tap?ss58=wallet` → per-escrow updates for wallet-specific orders
- [x] **Independent state management** — `orders` (public) and `myOrders` (private) are fully independent datasets. View switching is instant since both are pre-loaded in background.
- [x] **Notification source migration** — Notifications (filled/cancelled) now sourced exclusively from the private My Orders stream to prevent duplicates.
- [x] **Wallet change cleanup** — `myOrders` state and loaded flag reset when wallet address changes or disconnects. Private WS auto-reconnects to new address.
- [x] **Optimistic updates** — `handleUpdateOrder` and `handleCancelOrder` now update both `orders` and `myOrders` states for instant UI feedback across views.

### 2026-02-25 — Transaction Status UX Simplification

#### Completed
- [x] **Simplified wallet transaction status messages** — Replaced verbose chain status messages with clean 3-step flow: "Pending" (broadcast/ready) → "Confirming" (included in block) → "Confirmed" (finalized). Updated `lib/bittensor.ts` (both `transferTao` and `transferAlpha`), `hooks/useBittensorTransfer.ts` (status mapping + initial/final messages), and both order modals (fallback text + finalized banner).

### 2026-02-25 — Wallet Balance Checks Before Transfer

#### Completed
- [x] **On-chain balance check before order/fill** — Created `useWalletBalance` hook that queries the Bittensor chain for the user's TAO balance (`system.account`) and Alpha balance (`/stake/{coldkey}`) on the relevant subnet. Integrated into both `new-order-modal.tsx` and `fill-order-modal.tsx`:
  - **Proactive inline display**: Shows the user's current wallet balance below the order size input (with loading spinner while fetching)
  - **Insufficient funds warning**: Amber warning appears immediately when the entered amount exceeds the wallet balance (e.g. "Insufficient TAO. You need 5.0000 τ but only have 2.3456 τ")
  - **Fresh check at submission**: Right before the on-chain transfer (Step 0), `refetchBalance()` re-queries the chain for the latest balance and blocks the transfer with a clear error if insufficient
  - Buy orders check TAO balance, sell orders check Alpha balance on the order's subnet

### 2026-02-25 — Fill Order Completion UX Fix

#### Completed
- [x] **Fill Order button spinning after confirmation** — After on-chain transfer confirmed, the Fill Order button kept showing a spinner with "Fill Order" text while the backend `/rec` call was in progress. Users saw "Confirmed" but the button still spun, creating confusion about whether it was safe to close. Fixed with 3 changes:
  - **Clear status progression**: Banner now shows "Transfer confirmed. Submitting fill order…" (blue, with spinner) during the backend call, instead of the misleading "Confirmed. Filling order..." (green, no spinner)
  - **Button text reflects phase**: Button shows "Transferring..." during on-chain transfer, then "Submitting..." during backend call, instead of always showing "Fill Order"
  - **Explicit success state**: Instead of immediately closing the modal on success, shows a green banner with checkmark: "Order filled successfully. You may safely close this dialog." with a single Close button (no spinner). User now has clear confirmation before dismissing.

### 2026-02-25 — Order Permalinks

#### Completed
- [x] **Copy Link button** — Added "Copy Link" button to expanded row details for all orders (public and private). Copies `?order=UUID` permalink to clipboard with checkmark confirmation.
- [x] **Permalink landing UX** — When opening a `?order=UUID` link, the order is auto-expanded, scrolled into view, and highlighted with a blue ring animation that fades after ~3.5s. Works for both public orders (already in the book) and private orders (fetched via `/sql`).
- [x] **All view modes supported** — Permalink highlight/scroll works across desktop table, mobile card, and split view modes.

### 2026-02-25 — Order Status Propagation Fix

#### Status Lifecycle (from BE dev)
- **Parent/Origin order:** status 1 = Open → status 3 = Closed (after fill completes)
- **Child/Fill order:** status 2 = Filled, status 3 = Closed (fill failed/cancelled)

#### Completed
- [x] **Cross-stream status sync** — When the My Orders WS stream (`/ws/new?ss58=wallet`) receives status=2 or status=3 orders, the status is now propagated to the public `orders` state via `syncToPublicOrders()`. This ensures the Order Book view removes stale "open" entries when a fill closes the parent order.
- [x] **UUID collision fix in batch merges** — Both `mergeOrderBatch` (public) and `mergeMyOrderBatch` (private) now prefer the record with the higher positive status when the same UUID appears multiple times in a batch (e.g. a staging status=-1 row overwriting a later status). Prevents race conditions where iteration order could revert status.

#### Pending — BE Required
- [ ] **Parent order status update on fill** — Backend currently creates child fill order (status=2) but does NOT update the parent order's status from 1→3. Once BE implements this, the existing FE cross-stream sync will propagate the status change automatically. No additional FE work needed.

### 2026-02-25 — Floor/Ceiling Price Validation

#### Completed
- [x] **Block invalid floor/ceiling prices** — Previously the UI showed a misleading warning ("will act as a limit order") when a sell order's floor price was above market or a buy order's ceiling price was below market, but the backend rejected these outright with 400 errors. Changed to red error messages explaining the constraint, disabled all submission buttons (Create Escrow, Review Order, Place Order) when the price is invalid, and added a safety guard inside `handleNext()` as a backstop.

### 2026-02-25 — Close Order Error Handling

#### Completed
- [x] **Surface server error messages on close/modify** — `handleCancelOrder` and `handleUpdateOrder` now read the response body on non-OK (e.g. 400) responses and display the server's error message in the popup dialog instead of throwing a generic console error. Popup dialog title changed from hardcoded "Order closed" to generic "Order Update" so it works for both success and error messages.

### 2026-02-25 — UI Polish

#### Completed
- [x] **Floor/Ceiling price warning color** — Changed the inline validation messages for invalid floor/ceiling prices from red (`text-red-600`) to amber (`text-amber-600`) for a less alarming appearance while still clearly communicating the constraint.

### 2026-02-25 — Dynamic Stopped & Expired Order Badges

#### Completed
- [x] **Stopped badge** — Open orders now dynamically display a yellow "Stopped" badge when the live TAP market price breaches the stop price: sell orders when market <= floor (`stp`), buy orders when market >= ceiling (`stp`). Reverts to "Open" when the market moves back.
- [x] **Expired badge** — Open orders with a GTD (Good Till Date) display a yellow "Expired" badge when the current UTC time >= GTD. Reverts to "Open" if the user modifies the order to extend the date.
- [x] **`getDisplayStatus()` helper** — Added to `lib/types.ts`. Computes display status from live prices and current time for Open orders; all other statuses pass through unchanged. Priority: Expired > Stopped > Open.
- [x] **Unified amber color for both badges** — Changed status 6 (Expired) from purple to amber in `getStatusColor` so both Stopped and Expired use yellow/amber styling.
- [x] **All views updated** — Desktop table (`columns.tsx`) and mobile cards (`data-table.tsx`) both use `getDisplayStatus()`. Split view and row details confirmed no changes needed (split view only shows Open orders, row details only shows Filled/Closed child orders).

### 2026-02-26 — Private Order Fields

#### Completed
- [x] **Private order fields (accept, ask/bid, period)** — When "Public" is unchecked, three new fields appear:
  - **Counter Party Wallet Address** (`accept`): ss58 text input, restricts who can fill the order
  - **Ask/Bid Price** (`ask`/`bid`): Numeric input, auto-labels Ask (Sell) or Bid (Buy) based on order type, with manual toggle; defaults to "Ask/Bid Price" when no type selected
  - **Lock Period (Blocks)** (`period`): Integer input for block count
- [x] **Open Order modal** — Added collapsible section below Public checkbox with smooth transition, disabled after escrow creation (same pattern as other fields). All three `/rec` payload paths updated (handleNext, handleFinalPlaceOrder, handleReviewOrder).
- [x] **Modify Order dialog** — Added same three fields conditionally in the edit dialog when Public is unchecked. `handleSaveEdit` sends accept/ask/bid/period in the update payload.
- [x] **Row details expansion pane** — Both wallet and non-wallet variants display Counter Party, Ask/Bid Price, and Lock Period fieldsets when order is private.
- [x] **Fill Order modal** — Displays read-only "Private Order Details" info panel when parent order is private. All three payload paths (handleCreateEscrow, handleReviewOrder, handleFillOrder) now pass `accept` and `period`.
- [x] **Data model** — Extended `NewOrderFormData` interface with `accept`, `askBidPrice`, and `period` fields.

### 2026-02-26 — Clickable Auto-Fill Helpers

#### Completed
- [x] **Clickable wallet balance → auto-fill order size** — In both Open Order and Fill Order modals, the "Wallet balance: X.XXXX τ/α" text below the order size input is now clickable. Clicking it auto-fills the order size with the user's full wallet balance and switches the input mode to match the balance currency (TAO for buy orders, Alpha for sell orders). Disabled after escrow creation (same pattern as other fields).
- [x] **Clickable market price → auto-fill floor/ceiling price** — In the Open Order modal, the "Market Price X.XXXXXX" text below the Floor/Ceiling Price input is now clickable. Clicking it auto-fills the floor/ceiling price with the current market price. Disabled after escrow creation or when no market price is available.

### 2026-02-26 — Filter WS + Expansion Pane Fixes

#### Completed
- [x] **Self-referencing parent order fix** — Parent orders (where `origin === escrow`) appeared as their own child in the expansion pane. Fixed by filtering out the parent UUID from the `filledOrdersMap` lookup in both `renderSubComponent` and `renderSplitSubComponent` (`components/order-book/index.tsx`).
- [x] **Child-row column alignment** — Expansion pane's filled-orders table used hardcoded pixel widths in `<colgroup>` that could drift from the main table. Switched to percentage-based widths derived from the same column ratios (160/110/60/50/70/70/90/90 = 700px total). Added `align-middle` to child `<td>` cells to match ShadCN `TableCell`. Also fixed child Asset column reading `order.asset` (parent) instead of `filledOrder.asset`.
- [x] **Dedicated WS for ss58-filtered orders** — When the filter includes an ss58 address, the UI now opens a dedicated `/ws/new?ss58=address` WebSocket (same pattern as My Orders) to stream ALL orders for that address regardless of status/privacy. Non-ss58 filters still use client-side filtering of the public stream. My Orders remains a separate stream. Added: `filterAddress`/`filteredOrders`/`filteredFilledMap` state in `page.tsx`, `mergeFilteredBatch` + `handleFilteredWsMessage` handlers, threaded props through `index.tsx` → `data-table.tsx`, connection state indicator switches to filter WS when active.

## Discovered During Work
- `fill-order-modal.tsx` and `new-order-modal.tsx` also referenced old `getWebSocketBookUrl` — updated to `getWebSocketNewUrl`

## BE Tasks (Flagged for Later)
- Notification types "new matching order" and "whitelisted for private order" require BE push support
- Emissions/incentives design is fully BE
- Min order floor value (TBD)
- Max order as % of TAO pool (future dynamic scaling)

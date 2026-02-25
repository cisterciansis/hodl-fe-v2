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

## Discovered During Work
- `fill-order-modal.tsx` and `new-order-modal.tsx` also referenced old `getWebSocketBookUrl` — updated to `getWebSocketNewUrl`

## BE Tasks (Flagged for Later)
- Notification types "new matching order" and "whitelisted for private order" require BE push support
- Emissions/incentives design is fully BE
- Min order floor value (TBD)
- Max order as % of TAO pool (future dynamic scaling)

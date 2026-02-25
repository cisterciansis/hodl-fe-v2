# HODL Exchange - Architecture & Planning

## Overview
HODL Exchange is a decentralized order book for Bittensor Subnet 118, built with Next.js 15 (App Router), TypeScript, and Tailwind CSS.

## Architecture

### Frontend Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + ShadCN UI (Radix primitives)
- **State:** React Context (wallet, TAO price) + TanStack Query (subnet data) + local state (orders, prices)
- **Blockchain:** Polkadot.js / Bittensor wallet extensions

### Data Flow
- **Order Book:** Initial load + live updates via `/ws/new` (first message is full open-order batch)
- **Prices:** Initial load via REST `/price`, live updates via `/ws/tap`
- **TAO/Alpha/Price triplets:** Live updates via `/ws/tap` (per-escrow and subnet-wide)
- **TAO/USD price:** Pyth Hermes SSE (EventSource)
- **Block height:** Polling `/api/tmc/blocks` (server-side cached)

### WebSocket Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/ws/new` | Order book streaming (new orders, status changes) |
| `/ws/tap` | TAO/Alpha/Price triplet updates + subnet price broadcasts |

### Payload Contract
All `/rec` payloads follow canonical field order with `accept` (TEXT) and `period` (BIGINT) fields.
Payloads are built via `buildRecPayload()` in `lib/api-utils.ts` which ensures:
- Canonical field order: date, uuid, origin, escrow, wallet, accept, period, asset, type, ask, bid, stp, lmt, gtd, partial, public, tao, alpha, price, status
- N/A defaults: text → `''`, numbers → `0`, booleans → `false`

### UUID Contract
- `/ws/new` UUID is captured on first message and used for session binding
- Each modal gets its own WS connection and UUID
- UUID is preserved via ref across reconnections; if WS reconnects mid-escrow-flow, the user is warned and escrow state is reset
- `/ws/tap` UUID is ignored

### Key Components
- `app/page.tsx` — Main page, WS connections, order state management
- `components/order-book/` — Order book table, split view, row details, columns
- `components/notification-bell.tsx` — Notification system with localStorage persistence
- `components/hodl-logo.tsx` — SVG vector logo component
- `components/loading-screen.tsx` — Animated loading screen with safety timeout
- `hooks/useWebSocket.ts` — Generic WS hook with reconnection + UUID return + onReconnect callback
- `hooks/useWalletAutoReconnect.ts` — Auto-detect lost signers and refresh
- `lib/config.ts` — API/WS URL configuration (dev/prod)
- `lib/api-utils.ts` — API helpers + `buildRecPayload()` sanitizer

### Naming Conventions
- Components: PascalCase files, named exports
- Hooks: camelCase with `use` prefix
- Utils/config: camelCase files
- CSS: Tailwind utility classes, CSS custom properties for dynamic values

### File Structure
```
app/          — Next.js App Router pages and API routes
components/   — React components (order-book/, walletkit/, ui/)
context/      — React context providers
contexts/     — Additional context providers (taoPrice)
hooks/        — Custom React hooks
lib/          — Utilities, types, configuration
public/       — Static assets
```

# XRP Ledger Learning Project

A hands-on TypeScript project for learning XRPL core concepts using the official [`xrpl`](https://www.npmjs.com/package/xrpl) v5 SDK against the **testnet**.

## Features

| # | Feature | Script |
|---|---------|--------|
| 1 | Create wallet & fund via faucet | `src/index.ts` |
| 2 | Check XRP balance | `src/index.ts` |
| 3 | Send XRP from wallet A to wallet B | `src/index.ts` |
| 4 | Setup trustlines (USDC, EURC) | `src/trustlines.ts` |
| 5 | Monitor incoming transactions (WebSocket) | `src/monitor.ts` |
| 6 | Transaction history | `src/history.ts` |

## Prerequisites

- Node.js v18+
- npm

## Setup

```bash
npm install
```

## Running Scripts

> **Note:** Due to a known Node.js version conflict on some systems, run scripts directly:

```bash
# Send XRP (create wallets, fund, transfer, verify balances)
node node_modules/tsx/dist/cli.mjs src/index.ts

# Setup trustlines for USDC and EURC
node node_modules/tsx/dist/cli.mjs src/trustlines.ts

# Monitor incoming transactions via WebSocket
node node_modules/tsx/dist/cli.mjs src/monitor.ts

# Fetch transaction history
node node_modules/tsx/dist/cli.mjs src/history.ts
```

## Architecture

### Network
All scripts connect to the **XRPL Testnet** (`wss://s.altnet.rippletest.net:51233`). Accounts are funded automatically via the testnet faucet — no real XRP required.

### Transaction Pattern
Every transaction follows this strict flow:
```
client.autofill(tx)     → fills Fee, Sequence, LastLedgerSequence
wallet.sign(prepared)   → local signing, private key never sent to network
client.submitAndWait()  → submits and blocks until ledger validates
check tesSUCCESS        → explicit on-ledger result validation
```

### Trustlines (USDC / EURC)
USDC and EURC have no official issuers on testnet. The `trustlines.ts` script simulates the full gateway flow:
1. A **gateway wallet** is created and `asfDefaultRipple` is enabled
2. Holder wallets set a `TrustSet` to the gateway for each currency
3. Gateway issues tokens via `Payment` with `IssuedCurrencyAmount`
4. Peer-to-peer IOU transfer between holders is demonstrated

> On mainnet, replace the gateway address with the real Circle issuer address.

USDC and EURC use 40-character hex currency codes (XRPL only supports 3-char native codes):
- `USDC` → `5553444300000000000000000000000000000000`
- `EURC` → `4555524300000000000000000000000000000000`

### WebSocket Monitor
The monitor uses a server-side account subscription combined with a client-side event listener:
```ts
await client.request({ command: "subscribe", accounts: [address] });
client.on("transaction", (tx: TransactionStream) => { ... });
```

### Transaction History
Uses `account_tx` with `DEFAULT_API_VERSION = 2`. In API v2, Payment responses use `DeliverMax` instead of `Amount`, and the transaction hash is a top-level field alongside `tx_json`.

## Project Structure

```
src/
  index.ts        — wallet creation, funding, XRP transfer, balance check
  trustlines.ts   — TrustSet setup and IOU issuance/transfer
  monitor.ts      — real-time WebSocket transaction monitoring
  history.ts      — paginated transaction history via account_tx
```

## Testnet Explorer

Look up any address or transaction hash on the testnet explorer:
```
https://testnet.xrpl.org/accounts/<address>
https://testnet.xrpl.org/transactions/<hash>
```

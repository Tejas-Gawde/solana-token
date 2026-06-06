# Bundler Backend

A backend platform for automating token deployment, wallet management, transaction orchestration, and launch workflows on the Solana blockchain.

Built with Express, TypeScript, SQLite, and Solana SDKs, the platform provides secure wallet infrastructure, token lifecycle management, metadata hosting, and atomic transaction execution through Jito bundles.

The project was designed to simplify complex blockchain operations by exposing a structured API for token creation, asset distribution, launch coordination, and on-chain transaction management.

Built with **Express 5**, **TypeScript**, **SQLite** (better-sqlite3), and **@solana/kit** / **@pump-fun/pump-sdk**.

## Features

- **Wallet management** — Generate, import, fund, and organize wallets with AES-encrypted private keys stored in SQLite
- **Token creation** — Create SPL tokens and attach Metaplex metadata
- **Pump.fun launches** — Launch tokens, initial buys, bonding curve queries, and migration
- **Metadata hosting** — Upload token images (converted to WebP) and serve pump.fun-style metadata JSON
- **SOL distribution** — Distribute SOL from a main wallet to multiple destination wallets via an obfuscated transfer path
- **Jito launch bundles** — Atomically launch a pump.fun token and execute coordinated buyer transactions in a single Jito bundle

## Prerequisites

- Node.js 18+
- npm
- A Solana RPC endpoint (devnet or mainnet)
- For production: a funded wallet and secure encryption keys

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000
CORS_ORIGIN=*

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# Jito (bundle launches)
JITO_BLOCK_ENGINE_URL=https://testnet.block-engine.jito.wtf/api/v1/bundles
JITO_DEFAULT_TIP_SOL=0.001
JITO_STATUS_TIMEOUT_MS=60000
JITO_STATUS_POLL_INTERVAL_MS=3000
JITO_COMPUTE_UNIT_PRICE_MICRO_LAMPORTS=100000

# Encryption (change in production!)
ENCRYPTION_KEY=your-32-char-encryption-key-here
ENCRYPTION_IV=your-16-char-iv-here

# Database
DB_PATH=./data/memecoin_launcher.db
```

> **Security:** Never commit `.env`. Use strong, unique `ENCRYPTION_KEY` and `ENCRYPTION_IV` values in production. Wallet private keys are encrypted at rest using these values.

### 3. Run the server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

The API starts on `http://localhost:3000` by default. SQLite is initialized automatically at `data/memecoin_launcher.db`.

### 4. Verify health

```bash
curl http://localhost:3000/api/health
```

## API Overview

All responses use a consistent envelope:

```json
{
  "success": true,
  "message": "...",
  "data": { }
}
```

### Health

| Method | Endpoint      | Description  |
|--------|---------------|--------------|
| GET    | `/api/health` | Health check |

### Wallets — `/api/wallets`

| Method | Endpoint                      | Description                  |
|--------|-------------------------------|------------------------------|
| POST   | `/generate`                   | Generate a new wallet        |
| POST   | `/batch-generate`             | Generate multiple wallets    |
| POST   | `/import`                     | Import an existing wallet    |
| POST   | `/fund`                       | Fund wallets from a source   |
| GET    | `/`                           | List wallets                 |
| GET    | `/:publicKey`                 | Get wallet details           |
| GET    | `/:publicKey/export`          | Export decrypted private key |
| GET    | `/batch-export/:groupTag`     | Batch export by group tag    |
| POST   | `/:publicKey/refresh-balance` | Refresh on-chain SOL balance |
| PATCH  | `/:publicKey`                 | Update wallet metadata       |
| DELETE | `/:publicKey`                 | Deactivate wallet            |

### Tokens — `/api/tokens`

| Method | Endpoint                 | Description                     |
|--------|--------------------------|---------------------------------|
| POST   | `/create`                | Create SPL token (no metadata)  |
| POST   | `/add-metadata`          | Add metadata to existing token  |
| POST   | `/create-with-metadata`  | Create token with metadata      |
| GET    | `/`                      | List tokens                     |
| GET    | `/:mintAddress`          | Get token from database         |
| GET    | `/:mintAddress/on-chain` | Get live on-chain mint info   |
| GET    | `/:mintAddress/metadata` | Get live on-chain metadata      |

### Pump.fun — `/api/pump`

| Method | Endpoint                        | Description                          |
|--------|---------------------------------|--------------------------------------|
| POST   | `/launch`                       | Launch token on pump.fun             |
| POST   | `/launch-with-buy`              | Launch with initial buy              |
| POST   | `/launch-with-mint-private-key` | Launch with caller-provided mint key |
| POST   | `/buy`                          | Buy on an existing bonding curve     |
| POST   | `/migrate`                      | Migrate a graduated pump             |
| GET    | `/bonding-curve/:mintAddress`   | Get bonding curve state              |

### Metadata — `/api/metadata`

| Method | Endpoint              | Description                          |
|--------|-----------------------|--------------------------------------|
| POST   | `/create-with-upload` | Create metadata with image upload    |
| POST   | `/create-with-url`    | Create metadata from image URL       |
| GET    | `/`                   | List metadata records                |
| GET    | `/:metadataId`        | Get metadata record                  |
| GET    | `/:metadataId/json`   | Get raw metadata JSON                |
| DELETE | `/:metadataId`        | Delete metadata and associated files |

Static assets are served at:

- `/images/:filename` — WebP token images
- `/metadata-json/:filename` — Metadata JSON files

### Distribute — `/api/distribute`

| Method | Endpoint                   | Description                        |
|--------|----------------------------|------------------------------------|
| POST   | `/`                        | Distribute SOL to multiple wallets |
| GET    | `/`                        | List distributions                 |
| GET    | `/:distributionId`         | Get distribution details           |
| GET    | `/:distributionId/wallets` | Get destination wallets            |

### Launch Bundle — `/api/launch-bundle`

| Method | Endpoint                 | Description                                         |
|--------|--------------------------|-----------------------------------------------------|
| POST   | `/launch`                | Launch via Jito bundle using a prior distribution   |
| POST   | `/launch-direct-wallets` | Launch via Jito bundle with directly specified buyers |
| GET    | `/:launchBundleId`       | Get launch bundle status and transaction signatures |

## Typical Launch Flow

```mermaid
flowchart LR
    A[Create metadata] --> B[Generate buyer wallets]
    B --> C[Distribute SOL]
    C --> D[Launch Jito bundle]
    D --> E[Token live on pump.fun]
```

1. **Create metadata** — `POST /api/metadata/create-with-upload` or `create-with-url`
2. **Generate wallets** — `POST /api/wallets/batch-generate` for creator and buyer wallets
3. **Fund & distribute** — Fund the main wallet, then `POST /api/distribute` to spread SOL to buyer wallets
4. **Launch bundle** — `POST /api/launch-bundle/launch` with token details, metadata URI, and buyer configs

## Project Structure

```
bundler-backend/
├── server.ts                 # Entry point
├── src/
│   ├── app.ts                # Express app & route registration
│   ├── config/               # Environment config & SQLite setup
│   ├── middleware/           # Error handling, async wrapper
│   ├── modules/
│   │   ├── wallet/           # Wallet CRUD & encryption
│   │   ├── token/            # SPL token creation
│   │   ├── pump-launch/      # pump.fun interactions
│   │   ├── metadata/         # Image upload & JSON generation
│   │   ├── distribute/       # SOL distribution
│   │   └── launch-bundle/    # Jito bundle orchestration
│   └── utils/                # Logger, crypto, API response helpers
├── public/
│   ├── images/               # Hosted token images (WebP)
│   └── metadata-json/        # Hosted metadata JSON
└── data/                     # SQLite database (gitignored)
```

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Runtime    | Node.js, TypeScript (ESM)               |
| Framework  | Express 5                               |
| Database   | SQLite via better-sqlite3               |
| Blockchain | Solana (@solana/kit, spl-token)         |
| Pump.fun   | @pump-fun/pump-sdk                      |
| Metadata   | @metaplex-foundation/mpl-token-metadata |
| Bundles    | Jito Block Engine                       |
| Validation | Zod                                     |
| Images     | Sharp (WebP conversion)                 |

## Scripts

| Command       | Description              |
|---------------|--------------------------|
| `npm run dev` | Start with nodemon (dev) |
| `npm start`   | Start server             |

## Notes

- Default Solana network is **devnet**. Point `SOLANA_RPC_URL` and `JITO_BLOCK_ENGINE_URL` at mainnet endpoints for production.
- The `public/` and `data/` directories are gitignored; they are created at runtime.
- Private keys are never stored in plaintext — they are encrypted with `ENCRYPTION_KEY` / `ENCRYPTION_IV` before persistence.

## License

Private — not for public distribution.

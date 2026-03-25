# /api/sponsor — Gas Sponsorship Endpoint

## What It Does

This Next.js API route acts as a **gas station** for the Suiki app. Merchant and customer wallets have zero SUI balance; every on-chain action is sponsored by a server-side keypair that pays the gas fee on their behalf.

The client builds a **transaction-kind-only PTB** (no gas or sender information), base64-encodes it, and sends it here. The server validates every command, signs as gas payer, and returns the signed bytes for the client to counter-sign with the user's wallet.

---

## PTB Validation (FIND-01 + FIND-16)

### Why validation is critical

Without validation, a malicious client could craft a PTB that calls arbitrary Move functions (e.g., transferring objects, calling third-party contracts) and have the sponsor pay for it. The sponsor's SUI balance and reputation are at stake.

### What is validated

Every command in the Programmable Transaction Block is inspected before signing:

| Check | Rule |
|-------|------|
| Command kind | Must be `MoveCall`. `TransferObjects`, `SplitCoins`, `MergeCoins`, and `Publish` are all rejected. |
| Package | Must be `{PACKAGE_ID}::suiki` — the deployed Suiki contract only. |
| Function | Must be one of the seven functions in `ALLOWED_FUNCTIONS` (see below). |
| Coverage | **ALL** commands are checked, not just the first (FIND-16). |

### Allowed functions

```
create_program
create_card_and_stamp
issue_stamp
redeem
update_program
sync_card_metadata
transfer_merchant
```

These match the `public fun` declarations in `move/suiki/sources/suiki.move`. If the Move module adds new public functions, update `ALLOWED_FUNCTIONS` in `route.ts` accordingly.

### Rejection behaviour

If any command fails validation the entire PTB is rejected with HTTP 403 and a message identifying the offending command kind or target. The sponsor never signs the transaction.

---

## Rate Limiting (FIND-02)

### Current implementation (in-memory)

Rate limits are tracked in a `Map<string, { count, resetAt }>` keyed by:

- **Sender address** — max 50 sponsored transactions per 24-hour window per wallet.
- **IP address** — same limit per originating IP (from `x-forwarded-for` / `x-real-ip`).

Both limits are checked; exceeding either returns HTTP 429.

### TODO: Replace with Redis before mainnet

The in-memory store has two critical limitations:

1. **Not shared across processes** — multiple Next.js server instances each maintain independent counters. A horizontally-scaled deployment can be trivially bypassed.
2. **Lost on restart** — rate limit state is wiped every time the server restarts.

**Recommended upgrade path:**

```ts
// Install: npm install @upstash/ratelimit @upstash/redis
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(50, '1 d'),
});

// Then in the handler:
const { success } = await ratelimit.limit(sender);
if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
```

Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your environment when upgrading.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SPONSOR_PRIVATE_KEY` | Yes | Ed25519 secret key for the gas-payer wallet, base64-encoded. **Never** use the `NEXT_PUBLIC_` prefix — this must remain server-only. |
| `NEXT_PUBLIC_PACKAGE_ID` | Yes | `0x`-prefixed package ID from `sui client publish`. The route returns HTTP 503 until this is set to a real value. |
| `NEXT_PUBLIC_SUI_NETWORK` | No | `"testnet"` or `"mainnet"`. Defaults to `"testnet"`. |

### Generating a sponsor keypair

```bash
# Using the Sui CLI:
sui keytool generate ed25519
# Copy the "privateKey" field (base64) into SPONSOR_PRIVATE_KEY

# Or using Node.js:
node -e "
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const kp = new Ed25519Keypair();
console.log('Private key:', Buffer.from(kp.getSecretKey()).toString('base64'));
console.log('Address:', kp.getPublicKey().toSuiAddress());
"
```

Fund the resulting address with SUI before attempting any sponsored transactions.

---

## Request / Response Contract

The request and response shapes are defined in `src/types/sui.ts` as `SponsoredTxRequest` and `SponsoredTxResponse`.

### Request

```
POST /api/sponsor
Content-Type: application/json

{
  "txKindBytes": "<base64-encoded transaction-kind bytes>",
  "sender": "0x<wallet-address>"
}
```

Build `txKindBytes` on the client using:

```ts
const kindBytes = await tx.build({ client, onlyTransactionKind: true });
const txKindBytes = Buffer.from(kindBytes).toString('base64');
```

### Success response (HTTP 200)

```json
{
  "transactionBytes": "<base64 full tx bytes>",
  "sponsorSignature": "<base64 sponsor signature>"
}
```

The client must then obtain the user's signature and execute:

```ts
const userSignature = await wallet.signTransaction({ transaction: transactionBytes });
await client.executeTransactionBlock({
  transactionBlock: transactionBytes,
  signature: [userSignature, sponsorSignature],
});
```

### Error responses

| Status | Meaning |
|--------|---------|
| 400 | Malformed JSON, missing `txKindBytes`, missing `sender`, or unparseable transaction bytes. |
| 403 | PTB contains a command that is not in the allowlist (unauthorized module, function, or command type). |
| 429 | Rate limit exceeded (50 requests per sender or IP per 24 hours). |
| 503 | Server misconfiguration: `NEXT_PUBLIC_PACKAGE_ID` not set or `SPONSOR_PRIVATE_KEY` missing/invalid. |
| 500 | Unexpected error during signing (see server logs). |

---

## Testing the Endpoint Locally

### 1. Set environment variables

Create or update `.env.local` in the project root:

```
SPONSOR_PRIVATE_KEY=<base64-ed25519-secret-key>
NEXT_PUBLIC_PACKAGE_ID=0x<deployed-package-id>
NEXT_PUBLIC_SUI_NETWORK=testnet
```

### 2. Start the dev server

```bash
npm run dev
```

### 3. Send a test request with curl

```bash
# Build txKindBytes in a Node.js REPL first, then:
curl -X POST http://localhost:3000/api/sponsor \
  -H 'Content-Type: application/json' \
  -d '{
    "txKindBytes": "<your-base64-tx-kind-bytes>",
    "sender": "0x<your-wallet-address>"
  }'
```

### 4. Rejection test — non-suiki target

Send a PTB that calls any other package; the server should respond with HTTP 403:

```bash
curl -X POST http://localhost:3000/api/sponsor \
  -H 'Content-Type: application/json' \
  -d '{
    "txKindBytes": "<base64-bytes-calling-0xDEAD::foo::bar>",
    "sender": "0x<your-address>"
  }'
# Expected: 403 { "error": "Transaction rejected: Call to unauthorized module rejected: ..." }
```

### 5. Rate limit test

Send more than 50 requests from the same sender within 24 hours; the 51st should return HTTP 429.

---

## Security Checklist

- [ ] `SPONSOR_PRIVATE_KEY` is in `.env.local` (git-ignored) and not committed.
- [ ] `NEXT_PUBLIC_PACKAGE_ID` points to the production package after mainnet deploy.
- [ ] Redis rate limiting is configured before mainnet launch (see TODO above).
- [ ] The sponsor wallet holds only enough SUI for gas — never custody funds.
- [ ] Monitor sponsor wallet balance and alert when it falls below a threshold.

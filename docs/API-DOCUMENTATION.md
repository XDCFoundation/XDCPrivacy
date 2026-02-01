# XDC Privacy API Documentation

**Base URL:** `https://api.canton.xdc.network`  
**Frontend:** `https://canton.xdc.network`

---

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## 1. Party Management

### Register a New Party

Creates a new party with auto-generated encryption keys.

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "Acme Corporation",
  "email": "admin@acme.com",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "message": "Party registered successfully",
  "party": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corporation",
    "email": "admin@acme.com",
    "publicKey": "04a1b2c3...",
    "encryptionKey": "04d4e5f6...",
    "publicKeyHash": "0x7f8a9b..."
  },
  "keys": {
    "warning": "SAVE THESE PRIVATE KEYS SECURELY - THEY CANNOT BE RECOVERED",
    "identityPrivateKey": "0x...",
    "encryptionPrivateKey": "0x..."
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

⚠️ **Important:** Save the private keys immediately. They are only shown once!

---

### Login

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@acme.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "party": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corporation",
    "email": "admin@acme.com",
    "publicKey": "04a1b2c3...",
    "encryptionKey": "04d4e5f6..."
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### Get Current Party Info

```bash
GET /api/v1/auth/me
Authorization: Bearer <token>
```

---

### Lookup Party by Email

```bash
GET /api/v1/auth/lookup?email=partner@company.com
```

---

## 2. Privacy Domains

### Create a Domain

```bash
POST /api/v1/domains
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Trade Finance Consortium",
  "description": "Private domain for LC transactions"
}
```

**Response (201):**
```json
{
  "id": "domain-uuid",
  "domainId": "0x7f8a9b...",
  "name": "Trade Finance Consortium",
  "description": "Private domain for LC transactions",
  "adminId": "your-party-id",
  "isActive": true,
  "registrationTxHash": "0xabc123..."
}
```

---

### List Your Domains

```bash
GET /api/v1/domains
Authorization: Bearer <token>
```

---

### Invite Party to Domain

```bash
POST /api/v1/domains/:domainId/members
Authorization: Bearer <token>
Content-Type: application/json

{
  "partyId": "party-uuid-to-invite",
  "role": "MEMBER"  // ADMIN | MEMBER | OBSERVER | AUDITOR
}
```

---

## 3. Private Transactions

### Create a Private Transaction

Only parties listed will be able to see the transaction details.

```bash
POST /api/v1/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "domainId": "domain-uuid",
  "type": "TRADE_FINANCE",
  "parties": [
    { "partyId": "buyer-uuid", "role": "SIGNATORY" },
    { "partyId": "seller-uuid", "role": "SIGNATORY" },
    { "partyId": "bank-uuid", "role": "OBSERVER" }
  ],
  "payload": {
    "transactionType": "Letter of Credit",
    "amount": 500000,
    "currency": "USD",
    "buyer": "Acme Corp",
    "seller": "Steel Industries",
    "commodity": "Hot-rolled steel coils",
    "quantity": "500 MT",
    "deliveryTerms": "FOB Shanghai",
    "expiryDate": "2026-06-30"
  }
}
```

**Response (201):**
```json
{
  "id": "tx-uuid",
  "transactionId": "TXN-2026-001",
  "domainId": "domain-uuid",
  "commitmentHash": "0x8a7b6c5d4e3f2a1b...",
  "txType": "TRADE_FINANCE",
  "status": "PENDING",
  "parties": [...],
  "createdAt": "2026-02-01T18:00:00Z"
}
```

---

### List Your Transactions

```bash
GET /api/v1/transactions
Authorization: Bearer <token>
```

Returns only transactions where you are a party.

---

### Get Transaction Details

```bash
GET /api/v1/transactions/:transactionId
Authorization: Bearer <token>
```

Returns decrypted payload only if you are an authorized party.

---

### Sign a Transaction

```bash
POST /api/v1/transactions/:transactionId/sign
Authorization: Bearer <token>
Content-Type: application/json

{
  "signature": "0x...",  // Signed with your identity private key
  "privateKey": "0x..."  // Your identity private key (for server-side signing)
}
```

---

### Commit Transaction On-Chain

After all required signatures are collected:

```bash
POST /api/v1/commitments
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionId": "tx-uuid"
}
```

**Response:**
```json
{
  "commitmentHash": "0x8a7b6c5d4e3f2a1b...",
  "txHash": "0xdef456...",
  "blockNumber": 12345678,
  "status": "COMMITTED"
}
```

---

## 4. Selective Disclosure

### Create Disclosure for Auditor

```bash
POST /api/v1/disclosures
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionId": "tx-uuid",
  "receiverId": "auditor-party-uuid",
  "disclosedFields": ["amount", "buyer", "seller", "currency"],
  "purpose": "Regulatory audit Q1 2026",
  "expiresAt": "2026-03-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "disclosure-uuid",
  "transactionId": "tx-uuid",
  "disclosedFields": ["amount", "buyer", "seller", "currency"],
  "merkleProof": "...",
  "createdAt": "2026-02-01T18:00:00Z"
}
```

---

### View Disclosed Data (as Auditor)

```bash
GET /api/v1/disclosures/:disclosureId
Authorization: Bearer <auditor-token>
```

**Response:**
```json
{
  "transactionId": "tx-uuid",
  "commitmentHash": "0x8a7b6c5d4e3f2a1b...",
  "disclosedData": {
    "amount": 500000,
    "buyer": "Acme Corp",
    "seller": "Steel Industries",
    "currency": "USD"
  },
  "merkleProof": "...",
  "verified": true
}
```

---

## 5. On-Chain Verification

### Verify Commitment

```bash
GET /api/v1/commitments/:commitmentHash/verify
```

**Response:**
```json
{
  "exists": true,
  "commitmentHash": "0x8a7b6c5d4e3f2a1b...",
  "domainId": "0x7f8a9b...",
  "timestamp": 1706810400,
  "blockNumber": 12345678
}
```

---

## 6. WebSocket Events

Connect to: `wss://api.canton.xdc.network/ws`

### Events

| Event | Description |
|-------|-------------|
| `transaction.created` | New transaction you're party to |
| `transaction.signed` | A party signed a transaction |
| `transaction.committed` | Transaction committed on-chain |
| `disclosure.created` | New disclosure granted to you |

---

## Transaction Types

| Type | Description |
|------|-------------|
| `TRADE_FINANCE` | Letters of credit, trade documents |
| `RWA_TRANSFER` | Real-world asset transfers |
| `DVP_SETTLEMENT` | Delivery vs Payment atomic swaps |
| `PAYMENT` | Private payment instructions |
| `CUSTOM` | Custom transaction type |

---

## Transaction Status Flow

```
PENDING → PARTIALLY_SIGNED → FULLY_SIGNED → COMMITTED → EXECUTED
                                              ↓
                                          CANCELLED
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad request / Validation error |
| 401 | Unauthorized / Invalid token |
| 403 | Forbidden / Not a party to transaction |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Rate Limits

- 100 requests per minute per API key
- WebSocket: 50 messages per minute

---

*API Version: 1.0*  
*Last Updated: February 2026*

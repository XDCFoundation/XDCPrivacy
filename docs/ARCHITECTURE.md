# XDC Canton-Style Privacy System Architecture

## Executive Summary

This document describes the architecture for implementing Canton Network-style privacy on XDC Network. The system enables **"need-to-know" privacy** where only parties directly involved in a transaction can see its details, while maintaining cryptographic integrity through on-chain commitments.

## 1. Core Privacy Model

### 1.1 Canton Network Principles (Adapted for XDC)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         XDC CANTON PRIVACY MODEL                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Party A ◄──────► Private Domain ◄──────► Party B                     │
│      │                   │                    │                         │
│      │         ┌─────────┴─────────┐         │                         │
│      │         │  Off-Chain Store  │         │                         │
│      │         │  (Encrypted Data) │         │                         │
│      │         └─────────┬─────────┘         │                         │
│      │                   │                   │                         │
│      ▼                   ▼                   ▼                         │
│   ┌──────────────────────────────────────────────────────────┐        │
│   │              XDC Network (Public Ledger)                  │        │
│   │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │        │
│   │  │ Commitment │  │ Commitment │  │ Commitment │   ...    │        │
│   │  │   Hash 1   │  │   Hash 2   │  │   Hash 3   │          │        │
│   │  └────────────┘  └────────────┘  └────────────┘          │        │
│   └──────────────────────────────────────────────────────────┘        │
│                                                                         │
│   Key: Only hashes on-chain. Full data only visible to involved parties│
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Privacy Guarantees

| Property | Description |
|----------|-------------|
| **Transaction Privacy** | Only signatories and observers see transaction details |
| **Party Anonymity** | Third parties cannot identify transaction participants |
| **Selective Disclosure** | Parties can reveal specific fields to auditors |
| **Integrity** | On-chain commitments prevent tampering |
| **Non-repudiation** | Digital signatures prove party consent |

## 2. System Architecture

### 2.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   Web Client    │  │   SDK/Library   │  │   CLI Tools     │             │
│  │   (React/Next)  │  │   (TypeScript)  │  │                 │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
└───────────┼────────────────────┼────────────────────┼───────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│                         (Authentication & Routing)                           │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRIVACY ENGINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │  Transaction  │  │   Encryption  │  │    Access     │  │   Audit      │ │
│  │   Processor   │  │    Service    │  │   Control     │  │   Service    │ │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └──────┬───────┘ │
│          │                  │                  │                  │        │
│          └──────────────────┼──────────────────┼──────────────────┘        │
│                             │                  │                           │
│                             ▼                  ▼                           │
│              ┌──────────────────────────────────────────┐                  │
│              │         Commitment Generator             │                  │
│              │   (Hash creation, Merkle trees, etc.)    │                  │
│              └──────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
            │                                    │
            ▼                                    ▼
┌──────────────────────────┐      ┌──────────────────────────────────────────┐
│    OFF-CHAIN STORAGE     │      │              XDC NETWORK                  │
├──────────────────────────┤      ├──────────────────────────────────────────┤
│  ┌────────────────────┐  │      │  ┌────────────────────────────────────┐  │
│  │ Encrypted Tx Store │  │      │  │   PrivacyCommitment Contract       │  │
│  │    (PostgreSQL)    │  │      │  │   - recordCommitment()             │  │
│  └────────────────────┘  │      │  │   - verifyCommitment()             │  │
│  ┌────────────────────┐  │      │  │   - getCommitmentsByParty()        │  │
│  │   Party Registry   │  │      │  └────────────────────────────────────┘  │
│  │   (Public Keys)    │  │      │  ┌────────────────────────────────────┐  │
│  └────────────────────┘  │      │  │   DomainRegistry Contract          │  │
│  ┌────────────────────┐  │      │  │   - registerDomain()               │  │
│  │   Domain Config    │  │      │  │   - addParticipant()               │  │
│  │                    │  │      │  │   - getDomainParties()             │  │
│  └────────────────────┘  │      │  └────────────────────────────────────┘  │
└──────────────────────────┘      └──────────────────────────────────────────┘
```

### 2.2 Data Flow: Private Transaction Lifecycle

```
Step 1: Transaction Creation
────────────────────────────
Party A creates a private transaction (e.g., trade finance)

    {
      "type": "trade_finance",
      "buyer": "partyA_pubkey",
      "seller": "partyB_pubkey",
      "amount": 100000,
      "commodity": "Steel",
      "delivery_date": "2025-03-01"
    }

Step 2: Party Identification & Key Retrieval
────────────────────────────────────────────
System identifies all parties and retrieves their public keys

    parties = [PartyA, PartyB]
    keys = [PartyA.publicKey, PartyB.publicKey]

Step 3: Encryption & Commitment Generation
──────────────────────────────────────────
                                    ┌──────────────────────┐
    Transaction Data ──────────────►│ Generate Commitment  │
           │                        │ (SHA3-256 hash)      │
           │                        └──────────┬───────────┘
           │                                   │
           ▼                                   ▼
    ┌──────────────────┐              ┌──────────────────┐
    │ Encrypt for each │              │   Commitment:    │
    │ party with their │              │   0xabc123...    │
    │ public key       │              └──────────────────┘
    └──────────────────┘

Step 4: Storage & Recording
───────────────────────────
    Off-Chain:                          On-Chain:
    ┌─────────────────────┐            ┌─────────────────────┐
    │ Store encrypted     │            │ Record commitment   │
    │ copies for each     │            │ hash + party hints  │
    │ party               │            │ (encrypted)         │
    └─────────────────────┘            └─────────────────────┘

Step 5: Party Notification & Access
───────────────────────────────────
    Party A: Can decrypt with private key ✓
    Party B: Can decrypt with private key ✓
    Party C: Cannot access (not a party) ✗
    Auditor: Access via selective disclosure (if granted)
```

## 3. Core Components Detail

### 3.1 Privacy Domains

A **Privacy Domain** is an isolated environment where a set of parties can conduct private transactions. Think of it as a "private consortium" anchored to XDC.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIVACY DOMAIN: "TradeFinance_Corp"          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Domain ID: 0x7f8a...                                         │
│   Admin: Bank A                                                │
│                                                                 │
│   Participants:                                                │
│   ├── Bank A (Admin, Validator)                                │
│   ├── Exporter Corp (Member)                                   │
│   ├── Importer Inc (Member)                                    │
│   └── Customs Authority (Observer/Auditor)                     │
│                                                                 │
│   Rules:                                                       │
│   ├── All transactions require 2-party signature               │
│   ├── Auditor sees: amount, parties (not commodity details)    │
│   └── Settlement auto-triggers on delivery confirmation        │
│                                                                 │
│   Anchor: XDC Mainnet (commitment every 100 blocks)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Commitment Structure

```javascript
// On-chain commitment structure
{
  commitmentId: bytes32,       // Unique identifier
  commitmentHash: bytes32,     // SHA3-256(transaction_data + nonce)
  domainId: bytes32,           // Privacy domain this belongs to
  partyHints: bytes32[],       // Encrypted hints for party discovery
  timestamp: uint256,          // Block timestamp
  txType: uint8,               // Transaction type enum
  version: uint8               // Protocol version
}

// Off-chain transaction envelope (stored encrypted per party)
{
  transactionId: string,
  commitment: string,          // Matches on-chain commitment
  type: string,
  payload: {                   // The actual transaction data
    // Varies by transaction type
  },
  parties: [
    {
      role: "signatory" | "observer",
      publicKey: string,
      signature: string        // Party's signature on the tx
    }
  ],
  metadata: {
    createdAt: timestamp,
    domainId: string,
    version: string
  },
  auditFields: string[],       // Fields disclosed to auditors
  nonce: string                // Random nonce for commitment
}
```

### 3.3 Encryption Scheme

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID ENCRYPTION SCHEME                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   For each transaction:                                         │
│                                                                 │
│   1. Generate random AES-256-GCM key (DEK - Data Encryption Key)│
│                                                                 │
│   2. Encrypt transaction data with DEK                          │
│      encrypted_data = AES-256-GCM(DEK, transaction_data)        │
│                                                                 │
│   3. For each party, encrypt DEK with their public key          │
│      encrypted_dek_A = ECIES(PartyA.publicKey, DEK)            │
│      encrypted_dek_B = ECIES(PartyB.publicKey, DEK)            │
│                                                                 │
│   4. Store envelope:                                            │
│      {                                                          │
│        encrypted_data: "...",                                   │
│        keys: {                                                  │
│          "partyA_pubkey_hash": "encrypted_dek_A",              │
│          "partyB_pubkey_hash": "encrypted_dek_B"               │
│        }                                                        │
│      }                                                          │
│                                                                 │
│   5. Party decryption:                                          │
│      DEK = ECIES_decrypt(party.privateKey, encrypted_dek)       │
│      data = AES-256-GCM_decrypt(DEK, encrypted_data)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Selective Disclosure for Auditors

```
┌─────────────────────────────────────────────────────────────────┐
│                   SELECTIVE DISCLOSURE FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Transaction:                                                  │
│   {                                                             │
│     "trade_id": "TRD-001",                                     │
│     "buyer": "Acme Corp",           ◄── Disclose to auditor    │
│     "seller": "Steel Inc",          ◄── Disclose to auditor    │
│     "amount": 500000,               ◄── Disclose to auditor    │
│     "commodity": "Hot-rolled steel", ─── Keep private          │
│     "unit_price": 850,               ─── Keep private          │
│     "delivery_terms": "FOB Shanghai" ─── Keep private          │
│   }                                                             │
│                                                                 │
│   Auditor View (after selective disclosure):                    │
│   {                                                             │
│     "trade_id": "TRD-001",                                     │
│     "buyer": "Acme Corp",                                      │
│     "seller": "Steel Inc",                                     │
│     "amount": 500000,                                          │
│     "commitment_hash": "0xabc...",    // Proves completeness   │
│     "disclosed_fields_hash": "0xdef..." // Proves authenticity │
│   }                                                             │
│                                                                 │
│   Cryptographic proof:                                          │
│   - Merkle proof shows disclosed fields are part of original   │
│   - Auditor cannot see undisclosed fields                      │
│   - Auditor can verify disclosed data is authentic             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 4. Smart Contract Architecture

### 4.1 Contract Overview

```solidity
// PrivacyCommitmentRegistry.sol
contract PrivacyCommitmentRegistry {
    struct Commitment {
        bytes32 commitmentHash;
        bytes32 domainId;
        bytes32[] partyHints;  // Encrypted party identifiers
        uint256 timestamp;
        uint8 txType;
        bool exists;
    }
    
    mapping(bytes32 => Commitment) public commitments;
    mapping(bytes32 => bytes32[]) public domainCommitments;
    
    event CommitmentRecorded(
        bytes32 indexed commitmentId,
        bytes32 indexed domainId,
        bytes32 commitmentHash,
        uint256 timestamp
    );
    
    function recordCommitment(
        bytes32 commitmentId,
        bytes32 commitmentHash,
        bytes32 domainId,
        bytes32[] calldata partyHints,
        uint8 txType
    ) external;
    
    function verifyCommitment(
        bytes32 commitmentId,
        bytes32 expectedHash
    ) external view returns (bool);
}

// DomainRegistry.sol
contract DomainRegistry {
    struct Domain {
        bytes32 domainId;
        address admin;
        bytes32[] participantHints;  // Encrypted
        bool active;
        uint256 createdAt;
    }
    
    mapping(bytes32 => Domain) public domains;
    
    function registerDomain(bytes32 domainId) external;
    function addParticipant(bytes32 domainId, bytes32 participantHint) external;
    function removeDomain(bytes32 domainId) external;
}
```

### 4.2 Gas Optimization

| Operation | Estimated Gas | Cost @ 0.1 Gwei |
|-----------|---------------|-----------------|
| Record Commitment | ~80,000 | ~0.000008 XDC |
| Verify Commitment | ~25,000 | ~0.0000025 XDC |
| Register Domain | ~120,000 | ~0.000012 XDC |
| Add Participant | ~45,000 | ~0.0000045 XDC |

## 5. API Design

### 5.1 REST API Endpoints

```
Authentication & Identity
─────────────────────────
POST   /api/v1/auth/register          # Register new party
POST   /api/v1/auth/login             # Authenticate party
GET    /api/v1/auth/keys              # Get party's key pair info

Privacy Domains
───────────────
POST   /api/v1/domains                # Create new domain
GET    /api/v1/domains                # List domains user belongs to
GET    /api/v1/domains/:id            # Get domain details
POST   /api/v1/domains/:id/invite     # Invite party to domain
POST   /api/v1/domains/:id/join       # Accept domain invitation

Private Transactions
────────────────────
POST   /api/v1/transactions           # Create private transaction
GET    /api/v1/transactions           # List accessible transactions
GET    /api/v1/transactions/:id       # Get transaction (if authorized)
POST   /api/v1/transactions/:id/sign  # Sign transaction as party
GET    /api/v1/transactions/:id/verify # Verify against on-chain commitment

Selective Disclosure
────────────────────
POST   /api/v1/disclosures            # Create disclosure for auditor
GET    /api/v1/disclosures/:id        # Get disclosed data (auditor)
POST   /api/v1/disclosures/:id/verify # Verify disclosure authenticity

On-Chain Operations
───────────────────
GET    /api/v1/commitments/:hash      # Get commitment details from chain
POST   /api/v1/commitments/verify     # Verify data against commitment
```

### 5.2 WebSocket Events

```javascript
// Real-time notifications for parties
ws.on('transaction.created', (data) => {
  // New transaction you're party to
});

ws.on('transaction.signed', (data) => {
  // Co-party signed a transaction
});

ws.on('transaction.committed', (data) => {
  // Transaction committed on-chain
});

ws.on('disclosure.requested', (data) => {
  // Auditor requested disclosure
});
```

## 6. Security Considerations

### 6.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Key compromise | Key rotation, multi-sig for high-value txs |
| Malicious party shares data | Legal agreements + cryptographic audit trail |
| On-chain analysis | Encrypted party hints, batch commitments |
| Storage breach | AES-256 encryption, keys never stored |
| Man-in-the-middle | TLS 1.3, certificate pinning |

### 6.2 Key Management

```
┌─────────────────────────────────────────────────────────────────┐
│                      KEY HIERARCHY                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Master Key (derived from password + hardware token)           │
│        │                                                        │
│        ├──► Identity Key (secp256k1)                           │
│        │         │                                              │
│        │         ├──► XDC Account (transaction signing)        │
│        │         └──► Party Identity (authentication)          │
│        │                                                        │
│        └──► Encryption Key (X25519)                            │
│                  │                                              │
│                  └──► Used for ECIES encryption of DEKs        │
│                                                                 │
│   Key Storage:                                                  │
│   - Private keys: Client-side only (browser/HSM)               │
│   - Public keys: Party registry (server-side)                  │
│   - DEKs: Encrypted per-party, stored with transaction         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 7. Deployment Architecture

### 7.1 Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT: 95.217.56.168                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   DNS: *.canton.xdc.network → 95.217.56.168                    │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                      NGINX                               │  │
│   │   canton.xdc.network → Frontend (port 3000)             │  │
│   │   api.canton.xdc.network → Backend (port 4000)          │  │
│   │   ws.canton.xdc.network → WebSocket (port 4000)         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│          ┌───────────────────┼───────────────────┐             │
│          ▼                   ▼                   ▼             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│   │  Frontend   │    │   Backend   │    │  PostgreSQL │       │
│   │  Container  │    │  Container  │    │  Container  │       │
│   │  (Next.js)  │    │  (Node.js)  │    │             │       │
│   │  Port 3000  │    │  Port 4000  │    │  Port 5432  │       │
│   └─────────────┘    └─────────────┘    └─────────────┘       │
│                              │                                  │
│                              ▼                                  │
│                      ┌─────────────┐                           │
│                      │ XDC Node    │                           │
│                      │ (Apothem    │                           │
│                      │  Testnet)   │                           │
│                      └─────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Docker Compose Services

```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    
  backend:
    build: ./backend
    ports: ["4000:4000"]
    environment:
      - DATABASE_URL=postgresql://...
      - XDC_RPC_URL=https://rpc.apothem.network
      
  postgres:
    image: postgres:15
    volumes:
      - pg_data:/var/lib/postgresql/data
```

## 8. Use Case Examples

### 8.1 Trade Finance Letter of Credit

```
Parties: Issuing Bank, Advising Bank, Exporter, Importer

Step 1: Importer requests LC through Issuing Bank
        → Private transaction created
        → Only Importer + Issuing Bank see details
        
Step 2: Issuing Bank creates LC, adds Advising Bank
        → Transaction updated, encrypted for all 3 parties
        → Commitment recorded on XDC
        
Step 3: Advising Bank notifies Exporter
        → Exporter added as party
        → Full LC details visible to all 4 parties
        
Step 4: Regulatory audit requested
        → Selective disclosure: amount, parties, dates
        → Regulator cannot see: pricing, terms, goods description
```

### 8.2 Tokenized Asset DvP (Delivery vs Payment)

```
Parties: Seller, Buyer, Custodian

Atomic swap with privacy:
1. Seller creates private DvP offer (asset + price)
2. Buyer accepts (both sign transaction)
3. Custodian validates both sides
4. Single commitment recorded on-chain
5. Asset transfer + payment execute atomically
6. Only parties see the terms
```

## 9. Roadmap

### Phase 1: MVP (Current)
- [x] Architecture design
- [ ] Core encryption/decryption
- [ ] Basic transaction flow
- [ ] On-chain commitment contract
- [ ] Web UI for demo

### Phase 2: Enhanced Features
- [ ] Privacy domains
- [ ] Selective disclosure with Merkle proofs
- [ ] Multi-party signing flow
- [ ] Audit trail and compliance

### Phase 3: Production Ready
- [ ] HSM integration
- [ ] Key rotation
- [ ] Batch commitments
- [ ] Performance optimization

---

*Document Version: 1.0*
*Last Updated: February 2026*
*Author: XDC Privacy Team*

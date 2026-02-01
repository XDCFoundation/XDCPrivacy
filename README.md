# XDC Privacy

**Enterprise-grade confidential transactions on XDC Network**

Privacy-preserving transactions where only parties involved can see transaction details. On-chain commitments ensure integrity without revealing sensitive data.

🌐 **Live Demo:** https://privacy.xdc.network

## Features

- 🔐 **End-to-End Encryption** - Transaction details encrypted for each party
- ⛓️ **On-Chain Commitments** - Hash recorded on XDC, details stay private
- 👁️ **Selective Disclosure** - Grant auditors access to specific fields only
- 🏢 **Privacy Domains** - Create consortiums with member roles
- 🔗 **Wallet Connect** - MetaMask/XDCPay integration for on-chain commits

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         XDC PRIVACY MODEL                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Party A ◄──────► Private Transaction ◄──────► Party B                │
│      │                     │                        │                   │
│      │           ┌─────────┴─────────┐             │                   │
│      │           │  Off-Chain Store  │             │                   │
│      │           │ (Encrypted Data)  │             │                   │
│      │           └─────────┬─────────┘             │                   │
│      │                     │                       │                   │
│      ▼                     ▼                       ▼                   │
│   ┌──────────────────────────────────────────────────────────┐        │
│   │              XDC Network (Public Ledger)                  │        │
│   │  ┌────────────────────────────────────────────────────┐  │        │
│   │  │     Only Commitment Hash visible on-chain          │  │        │
│   │  │     0x8a7b6c5d4e3f2a1b...                         │  │        │
│   │  └────────────────────────────────────────────────────┘  │        │
│   └──────────────────────────────────────────────────────────┘        │
│                                                                         │
│   ✓ Party A sees full details    ✓ Party B sees full details          │
│   ✗ Public cannot see details    ✗ Third parties cannot see           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Transaction Flow

### 1. Create Private Transaction
```
Party A creates transaction with encrypted payload
    ↓
System generates commitment hash (SHA3-256)
    ↓
Payload encrypted separately for each party
    ↓
Transaction stored off-chain (encrypted)
```

### 2. Sign Transaction
```
Each party signs with their private key
    ↓
Signatures collected
    ↓
Status: PENDING → PARTIALLY_SIGNED → FULLY_SIGNED
```

### 3. Commit On-Chain
```
Commitment hash recorded on XDC Network
    ↓
Only hash visible publicly
    ↓
Full details remain private to parties
```

### 4. Selective Disclosure (Optional)
```
Party grants auditor access to specific fields
    ↓
Auditor sees: amount, parties (disclosed)
    ↓
Auditor cannot see: pricing, terms (hidden)
    ↓
Merkle proof verifies authenticity
```

## Use Cases

| Use Case | Description |
|----------|-------------|
| **Trade Finance** | Letters of credit, invoices with full confidentiality |
| **RWA Tokenization** | Private asset transfers with regulatory compliance |
| **Confidential DvP** | Delivery vs Payment with hidden terms |
| **Private Payments** | Confidential payment instructions |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│   PostgreSQL    │
│   (Next.js)     │     │   (Express)     │     │   (Encrypted)   │
│   Port 3001     │     │   Port 4000     │     │   Port 5432     │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   XDC Network   │
                        │ (Commitments)   │
                        └─────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL (or use Docker)

### Installation

```bash
# Clone the repository
git clone https://github.com/XDCFoundation/XDCPrivacy.git
cd XDCPrivacy

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies  
cd ../frontend && npm install

# Start with Docker
docker compose up -d
```

### Environment Variables

**Backend (.env)**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/xdc_privacy
JWT_SECRET=your-secret-key
XDC_RPC_URL=https://rpc.apothem.network
XDC_CHAIN_ID=51
```

**Frontend (.env)**
```env
NEXT_PUBLIC_API_URL=https://api.privacy.xdc.network
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/register` | POST | Register new party |
| `/api/v1/auth/login` | POST | Authenticate |
| `/api/v1/transactions` | POST | Create private transaction |
| `/api/v1/transactions` | GET | List your transactions |
| `/api/v1/transactions/:id/sign` | POST | Sign transaction |
| `/api/v1/disclosures` | POST | Create selective disclosure |

## Privacy Guarantees

| Actor | Can See | Cannot See |
|-------|---------|------------|
| **Transaction Party** | Full details | - |
| **Auditor (with disclosure)** | Disclosed fields only | Hidden fields |
| **Public (XDC Explorer)** | Commitment hash only | All details |
| **Third Party** | Nothing | Everything |

## Security

- **Encryption:** AES-256-GCM + ECIES hybrid encryption
- **Key Management:** Private keys never leave client
- **Commitments:** SHA3-256 hash with random nonce
- **Selective Disclosure:** Merkle proofs for field verification

## Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| XDC Mainnet | 50 | https://rpc.xdc.org |
| Apothem Testnet | 51 | https://rpc.apothem.network |

## Documentation

- [Architecture Document](docs/ARCHITECTURE.md)
- [API Documentation](docs/API-DOCUMENTATION.md)
- [Demo Guide](docs/DEMO-GUIDE.md)

## License

MIT License - see [LICENSE](LICENSE)

## Links

- 🌐 Live: https://privacy.xdc.network
- 📖 Docs: https://docs.xdc.network
- 💬 Discord: https://discord.gg/xdc

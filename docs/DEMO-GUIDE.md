# XDC Privacy Demo Guide

A step-by-step walkthrough demonstrating the privacy features.

---

## Quick Demo: Trade Finance Letter of Credit

### Scenario
- **Buyer:** Acme Corporation (wants to import steel)
- **Seller:** Steel Industries (exporter)
- **Bank:** Trade Finance Bank (issues LC)
- **Auditor:** Regulatory Authority (needs limited visibility)

---

## Step 1: Register Parties

### Register Buyer (Acme Corp)

```bash
curl -X POST https://api.canton.xdc.network/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "email": "buyer@acme.com",
    "password": "AcmeSecure123!"
  }'
```

Save the response - it contains your private keys!

### Register Seller (Steel Industries)

```bash
curl -X POST https://api.canton.xdc.network/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Steel Industries",
    "email": "seller@steel.com",
    "password": "SteelSecure123!"
  }'
```

### Register Bank

```bash
curl -X POST https://api.canton.xdc.network/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trade Finance Bank",
    "email": "ops@tfbank.com",
    "password": "BankSecure123!"
  }'
```

### Register Auditor

```bash
curl -X POST https://api.canton.xdc.network/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Regulatory Authority",
    "email": "audit@regulator.gov",
    "password": "RegSecure123!"
  }'
```

---

## Step 2: Login and Get Tokens

```bash
# Login as Bank (will create the domain and transaction)
BANK_TOKEN=$(curl -s -X POST https://api.canton.xdc.network/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ops@tfbank.com", "password": "BankSecure123!"}' \
  | jq -r '.token')

echo "Bank Token: $BANK_TOKEN"
```

---

## Step 3: Create Privacy Domain

The bank creates a private consortium for trade finance:

```bash
curl -X POST https://api.canton.xdc.network/api/v1/domains \
  -H "Authorization: Bearer $BANK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trade Finance Consortium",
    "description": "Private domain for LC transactions between verified parties"
  }'
```

---

## Step 4: Add Members to Domain

Get party IDs first:

```bash
# Lookup buyer
BUYER_ID=$(curl -s "https://api.canton.xdc.network/api/v1/auth/lookup?email=buyer@acme.com" \
  | jq -r '.partyId')

# Lookup seller
SELLER_ID=$(curl -s "https://api.canton.xdc.network/api/v1/auth/lookup?email=seller@steel.com" \
  | jq -r '.partyId')

# Lookup auditor
AUDITOR_ID=$(curl -s "https://api.canton.xdc.network/api/v1/auth/lookup?email=audit@regulator.gov" \
  | jq -r '.partyId')
```

Add them to the domain:

```bash
# Add buyer as member
curl -X POST "https://api.canton.xdc.network/api/v1/domains/$DOMAIN_ID/members" \
  -H "Authorization: Bearer $BANK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"partyId\": \"$BUYER_ID\", \"role\": \"MEMBER\"}"

# Add seller as member
curl -X POST "https://api.canton.xdc.network/api/v1/domains/$DOMAIN_ID/members" \
  -H "Authorization: Bearer $BANK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"partyId\": \"$SELLER_ID\", \"role\": \"MEMBER\"}"

# Add auditor as observer
curl -X POST "https://api.canton.xdc.network/api/v1/domains/$DOMAIN_ID/members" \
  -H "Authorization: Bearer $BANK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"partyId\": \"$AUDITOR_ID\", \"role\": \"AUDITOR\"}"
```

---

## Step 5: Create Private Transaction

Bank creates the LC transaction. Only listed parties can see the details:

```bash
curl -X POST https://api.canton.xdc.network/api/v1/transactions \
  -H "Authorization: Bearer $BANK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"domainId\": \"$DOMAIN_ID\",
    \"type\": \"TRADE_FINANCE\",
    \"parties\": [
      { \"partyId\": \"$BUYER_ID\", \"role\": \"SIGNATORY\" },
      { \"partyId\": \"$SELLER_ID\", \"role\": \"SIGNATORY\" }
    ],
    \"payload\": {
      \"documentType\": \"Letter of Credit\",
      \"lcNumber\": \"LC-2026-TF-001\",
      \"amount\": 500000,
      \"currency\": \"USD\",
      \"applicant\": \"Acme Corporation\",
      \"beneficiary\": \"Steel Industries\",
      \"issuingBank\": \"Trade Finance Bank\",
      \"commodity\": \"Hot-rolled steel coils\",
      \"quantity\": \"500 MT\",
      \"unitPrice\": 1000,
      \"incoterms\": \"FOB Shanghai\",
      \"shipmentDate\": \"2026-03-15\",
      \"expiryDate\": \"2026-06-30\",
      \"documents\": [
        \"Commercial Invoice\",
        \"Bill of Lading\",
        \"Packing List\",
        \"Certificate of Origin\"
      ]
    }
  }"
```

**Result:** Transaction created with:
- Commitment hash: `0x8a7b6c5d...` (will be recorded on XDC)
- Encrypted copies created for Buyer and Seller
- Bank sees it as creator
- **Auditor cannot see anything yet!**

---

## Step 6: Verify Privacy (As Different Parties)

### As Buyer - Can See Full Details ✅

```bash
BUYER_TOKEN=$(curl -s -X POST https://api.canton.xdc.network/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "buyer@acme.com", "password": "AcmeSecure123!"}' \
  | jq -r '.token')

curl https://api.canton.xdc.network/api/v1/transactions/$TX_ID \
  -H "Authorization: Bearer $BUYER_TOKEN"
```

**Returns:** Full transaction with all LC details.

### As Auditor - Access Denied ❌

```bash
AUDITOR_TOKEN=$(curl -s -X POST https://api.canton.xdc.network/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "audit@regulator.gov", "password": "RegSecure123!"}' \
  | jq -r '.token')

curl https://api.canton.xdc.network/api/v1/transactions/$TX_ID \
  -H "Authorization: Bearer $AUDITOR_TOKEN"
```

**Returns:** `403 Forbidden - You are not a party to this transaction`

---

## Step 7: Sign Transaction

Both buyer and seller must sign:

```bash
# Buyer signs
curl -X POST "https://api.canton.xdc.network/api/v1/transactions/$TX_ID/sign" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approve": true}'

# Seller signs  
curl -X POST "https://api.canton.xdc.network/api/v1/transactions/$TX_ID/sign" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approve": true}'
```

---

## Step 8: Commit On-Chain

Once fully signed, commit the hash to XDC:

```bash
curl -X POST https://api.canton.xdc.network/api/v1/commitments \
  -H "Authorization: Bearer $BANK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"transactionId\": \"$TX_ID\"}"
```

**Returns:**
```json
{
  "commitmentHash": "0x8a7b6c5d4e3f2a1b...",
  "txHash": "0xdef456789...",
  "blockNumber": 98765432,
  "explorerUrl": "https://explorer.apothem.network/tx/0xdef456789..."
}
```

🔗 **On-chain:** Only the commitment hash is visible. No transaction details!

---

## Step 9: Selective Disclosure to Auditor

Buyer grants limited access to the auditor:

```bash
curl -X POST https://api.canton.xdc.network/api/v1/disclosures \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"transactionId\": \"$TX_ID\",
    \"receiverId\": \"$AUDITOR_ID\",
    \"disclosedFields\": [\"amount\", \"currency\", \"applicant\", \"beneficiary\", \"issuingBank\"],
    \"purpose\": \"Regulatory compliance audit Q1 2026\",
    \"expiresAt\": \"2026-03-31T23:59:59Z\"
  }"
```

---

## Step 10: Auditor Views Disclosed Data

Now the auditor can see only the disclosed fields:

```bash
curl https://api.canton.xdc.network/api/v1/disclosures/$DISCLOSURE_ID \
  -H "Authorization: Bearer $AUDITOR_TOKEN"
```

**Returns:**
```json
{
  "transactionId": "tx-uuid",
  "commitmentHash": "0x8a7b6c5d4e3f2a1b...",
  "disclosedData": {
    "amount": 500000,
    "currency": "USD",
    "applicant": "Acme Corporation",
    "beneficiary": "Steel Industries",
    "issuingBank": "Trade Finance Bank"
  },
  "hiddenFields": ["commodity", "quantity", "unitPrice", "incoterms", "documents"],
  "verified": true,
  "merkleProof": "..."
}
```

**Auditor sees:** Amount, parties, bank ✅  
**Auditor cannot see:** Commodity, pricing, terms ❌

---

## Summary: Privacy Guarantees Demonstrated

| Actor | Can See | Cannot See |
|-------|---------|------------|
| **Buyer** | Full transaction details | - |
| **Seller** | Full transaction details | - |
| **Bank** | Full transaction details | - |
| **Auditor** | Only disclosed fields | Commodity, pricing, terms |
| **Public (XDC Explorer)** | Only commitment hash | Everything else |
| **Random third party** | Nothing | Everything |

---

## Using the Web UI

1. Go to https://canton.xdc.network
2. Register or login
3. Create domains and invite parties
4. Submit transactions through the dashboard
5. View your transactions (only ones you're party to)
6. Sign pending transactions
7. Grant disclosures to auditors

---

## Verifying On-Chain

Check any commitment on XDC Apothem:

```bash
curl "https://api.canton.xdc.network/api/v1/commitments/0x8a7b6c5d.../verify"
```

Or directly via XDC RPC:

```bash
curl -X POST https://rpc.apothem.network \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [{
      "to": "CONTRACT_ADDRESS",
      "data": "0x..."
    }, "latest"],
    "id": 1
  }'
```

---

*Demo Version: 1.0*  
*Network: XDC Apothem Testnet*

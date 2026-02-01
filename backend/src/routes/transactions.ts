import { Router, Request, Response } from 'express';
import { PrismaClient, TransactionType, TransactionStatus, PartyRole } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';
import {
  createEncryptedEnvelope,
  decryptEnvelope,
  generateCommitment,
  verifyCommitment,
  signData,
  verifySignature,
  buildMerkleTree,
  hashPublicKey
} from '../services/encryption';
import { getBlockchainService } from '../services/blockchain';

const router = Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const createTransactionSchema = z.object({
  domainId: z.string().uuid().optional(),
  type: z.enum(['TRADE_FINANCE', 'RWA_TRANSFER', 'DVP_SETTLEMENT', 'PAYMENT', 'CUSTOM']),
  payload: z.record(z.any()),
  parties: z.array(z.object({
    partyId: z.string().uuid(),
    role: z.enum(['SIGNATORY', 'OBSERVER'])
  })).optional(),
  counterpartyEmail: z.string().email().optional()
});

const signTransactionSchema = z.object({
  privateKey: z.string().min(64).max(66)
});

/**
 * POST /api/v1/transactions
 * Create a new private transaction
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { domainId, type, payload, parties: inputParties, counterpartyEmail } = createTransactionSchema.parse(req.body);

    let domain = null;
    let parties: Array<{partyId: string, role: 'SIGNATORY' | 'OBSERVER'}> = [];

    // If domainId provided, verify membership
    if (domainId) {
      domain = await prisma.domain.findUnique({
        where: { id: domainId },
        include: { members: true }
      });

      if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
      }

      const isMember = domain.members.some(m => m.partyId === currentPartyId);
      if (!isMember) {
        return res.status(403).json({ error: 'Not a member of this domain' });
      }
    } else {
      // Create ad-hoc domain for this transaction
      const domainIdHash = '0x' + uuidv4().replace(/-/g, '').substring(0, 64).padEnd(64, '0');
      domain = await prisma.domain.create({
        data: {
          domainId: domainIdHash,
          name: `Private Transaction ${new Date().toISOString().split('T')[0]}`,
          description: 'Auto-created domain for private transaction',
          adminId: currentPartyId,
          isActive: true
        },
        include: { members: true }
      });
      
      // Add creator as member
      await prisma.domainMember.create({
        data: {
          domainId: domain.id,
          partyId: currentPartyId,
          role: 'ADMIN'
        }
      });
    }

    // Build parties list
    if (inputParties && inputParties.length > 0) {
      parties = inputParties;
    } else {
      // Start with current party
      parties = [{ partyId: currentPartyId, role: 'SIGNATORY' }];
    }

    // If counterparty email provided, look them up
    if (counterpartyEmail) {
      const counterparty = await prisma.party.findUnique({
        where: { email: counterpartyEmail }
      });
      if (counterparty && !parties.some(p => p.partyId === counterparty.id)) {
        parties.push({ partyId: counterparty.id, role: 'SIGNATORY' });
      }
    }

    // Ensure current party is included as signatory
    const partyIds = parties.map(p => p.partyId);
    if (!partyIds.includes(currentPartyId)) {
      parties.push({ partyId: currentPartyId, role: 'SIGNATORY' });
    }

    // Fetch all party public keys
    const partyRecords = await prisma.party.findMany({
      where: { id: { in: parties.map(p => p.partyId) } },
      select: { id: true, name: true, encryptionKey: true, publicKey: true }
    });

    if (partyRecords.length !== parties.length) {
      return res.status(400).json({ error: 'One or more parties not found' });
    }

    // Generate transaction ID and commitment
    const transactionId = `TXN-${uuidv4().substring(0, 8).toUpperCase()}`;
    const { commitment: commitmentHash, nonce } = generateCommitment(payload);

    // Build Merkle tree for selective disclosure
    const { root: merkleRoot } = buildMerkleTree(payload);

    // Create encrypted envelopes for each party
    const publicKeys = partyRecords.map(p => p.encryptionKey);
    const envelope = createEncryptedEnvelope(
      { ...payload, _nonce: nonce, _transactionId: transactionId },
      publicKeys
    );

    // Create transaction in database
    const transaction = await prisma.privateTransaction.create({
      data: {
        transactionId,
        domainId: domain.id,
        commitmentHash,
        txType: type as TransactionType,
        status: TransactionStatus.PENDING,
        merkleRoot,
        parties: {
          create: parties.map(p => {
            const partyRecord = partyRecords.find(pr => pr.id === p.partyId)!;
            const keyHash = hashPublicKey(partyRecord.encryptionKey);
            return {
              partyId: p.partyId,
              role: p.role as PartyRole,
              encryptedPayload: JSON.stringify({
                encryptedData: envelope.encryptedData,
                iv: envelope.iv,
                authTag: envelope.authTag
              }),
              encryptedDek: envelope.encryptedKeys[keyHash]
            };
          })
        }
      },
      include: {
        parties: {
          include: {
            party: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        domain: {
          select: { id: true, name: true }
        }
      }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: 'TRANSACTION_CREATED',
        actorId: currentPartyId,
        resourceType: 'PrivateTransaction',
        resourceId: transaction.id,
        details: {
          transactionId,
          type,
          partyCount: parties.length
        }
      }
    });

    res.status(201).json({
      message: 'Private transaction created',
      transaction: {
        id: transaction.id,
        transactionId: transaction.transactionId,
        type: transaction.txType,
        status: transaction.status,
        commitmentHash: transaction.commitmentHash,
        merkleRoot: transaction.merkleRoot,
        domain: transaction.domain,
        parties: transaction.parties.map(p => ({
          partyId: p.party.id,
          name: p.party.name,
          role: p.role,
          signed: !!p.signature
        })),
        createdAt: transaction.createdAt
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/transactions
 * List transactions the current party has access to
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { domainId, status, limit = 50, offset = 0 } = req.query;

    const where: any = {
      parties: {
        some: { partyId: currentPartyId }
      }
    };

    if (domainId) where.domainId = domainId;
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.privateTransaction.findMany({
        where,
        include: {
          domain: { select: { id: true, name: true } },
          parties: {
            include: {
              party: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset)
      }),
      prisma.privateTransaction.count({ where })
    ]);

    res.json({
      transactions: transactions.map(tx => ({
        id: tx.id,
        transactionId: tx.transactionId,
        type: tx.txType,
        status: tx.status,
        commitmentHash: tx.commitmentHash,
        domain: tx.domain,
        parties: tx.parties.map(p => ({
          partyId: p.party.id,
          name: p.party.name,
          role: p.role,
          signed: !!p.signature
        })),
        committed: !!tx.commitmentTxHash,
        createdAt: tx.createdAt
      })),
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    console.error('List transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/transactions/:id
 * Get transaction details (only if party to the transaction)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;

    const transaction = await prisma.privateTransaction.findFirst({
      where: {
        OR: [{ id }, { transactionId: id }],
        parties: { some: { partyId: currentPartyId } }
      },
      include: {
        domain: { select: { id: true, name: true } },
        parties: {
          include: {
            party: { select: { id: true, name: true, email: true, publicKey: true } }
          }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found or access denied' });
    }

    // Get current party's encrypted data
    const partyData = transaction.parties.find(p => p.partyId === currentPartyId);

    res.json({
      id: transaction.id,
      transactionId: transaction.transactionId,
      type: transaction.txType,
      status: transaction.status,
      commitmentHash: transaction.commitmentHash,
      commitmentTxHash: transaction.commitmentTxHash,
      merkleRoot: transaction.merkleRoot,
      domain: transaction.domain,
      parties: transaction.parties.map(p => ({
        partyId: p.party.id,
        name: p.party.name,
        email: p.party.email,
        role: p.role,
        signed: !!p.signature,
        signedAt: p.signedAt
      })),
      // Encrypted data for this party to decrypt client-side
      encryptedEnvelope: partyData ? {
        encryptedPayload: partyData.encryptedPayload,
        encryptedDek: partyData.encryptedDek
      } : null,
      createdAt: transaction.createdAt,
      committedAt: transaction.committedAt
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/transactions/:id/decrypt
 * Decrypt transaction payload (client provides their private key)
 */
router.post('/:id/decrypt', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;
    const { privateKey } = req.body;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key required' });
    }

    // Get transaction and party data
    const transaction = await prisma.privateTransaction.findFirst({
      where: {
        OR: [{ id }, { transactionId: id }],
        parties: { some: { partyId: currentPartyId } }
      },
      include: {
        parties: {
          where: { partyId: currentPartyId },
          include: {
            party: { select: { encryptionKey: true } }
          }
        }
      }
    });

    if (!transaction || !transaction.parties[0]) {
      return res.status(404).json({ error: 'Transaction not found or access denied' });
    }

    const partyData = transaction.parties[0];
    const encryptedPayload = JSON.parse(partyData.encryptedPayload);
    
    // Build envelope for decryption
    const envelope = {
      encryptedData: encryptedPayload.encryptedData,
      iv: encryptedPayload.iv,
      authTag: encryptedPayload.authTag,
      encryptedKeys: {
        [hashPublicKey(partyData.party.encryptionKey)]: partyData.encryptedDek
      }
    };

    // Decrypt
    const result = decryptEnvelope(envelope, privateKey, partyData.party.encryptionKey);

    if (!result.success) {
      return res.status(400).json({ error: 'Decryption failed', details: result.error });
    }

    // Remove internal fields
    const { _nonce, _transactionId, ...payload } = result.data;

    res.json({
      transactionId: transaction.transactionId,
      payload,
      decryptedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Decrypt error:', error);
    res.status(500).json({ error: 'Decryption failed' });
  }
});

/**
 * POST /api/v1/transactions/:id/sign
 * Sign the transaction as a party
 */
router.post('/:id/sign', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;
    const { privateKey } = signTransactionSchema.parse(req.body);

    // Get transaction
    const transaction = await prisma.privateTransaction.findFirst({
      where: {
        OR: [{ id }, { transactionId: id }],
        parties: {
          some: {
            partyId: currentPartyId,
            role: 'SIGNATORY'
          }
        }
      },
      include: {
        parties: {
          include: {
            party: { select: { id: true, publicKey: true } }
          }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found or not a signatory' });
    }

    if (transaction.status === TransactionStatus.COMMITTED) {
      return res.status(400).json({ error: 'Transaction already committed' });
    }

    // Find current party's record
    const partyRecord = transaction.parties.find(p => p.partyId === currentPartyId);
    if (!partyRecord) {
      return res.status(403).json({ error: 'Not a party to this transaction' });
    }

    if (partyRecord.signature) {
      return res.status(400).json({ error: 'Already signed' });
    }

    // Sign the commitment hash
    const signature = signData(transaction.commitmentHash, privateKey);

    // Verify signature with public key
    if (!verifySignature(transaction.commitmentHash, signature, partyRecord.party.publicKey)) {
      return res.status(400).json({ error: 'Invalid signature - key mismatch' });
    }

    // Update party record with signature
    await prisma.transactionParty.update({
      where: { id: partyRecord.id },
      data: {
        signature,
        signedAt: new Date()
      }
    });

    // Check if all signatories have signed
    const allSignatories = transaction.parties.filter(p => p.role === 'SIGNATORY');
    const signedCount = allSignatories.filter(p => p.signature || p.partyId === currentPartyId).length;

    let newStatus = transaction.status;
    if (signedCount === allSignatories.length) {
      newStatus = TransactionStatus.FULLY_SIGNED;
    } else if (signedCount > 0) {
      newStatus = TransactionStatus.PARTIALLY_SIGNED;
    }

    await prisma.privateTransaction.update({
      where: { id: transaction.id },
      data: { status: newStatus }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'TRANSACTION_SIGNED',
        actorId: currentPartyId,
        resourceType: 'PrivateTransaction',
        resourceId: transaction.id,
        details: {
          transactionId: transaction.transactionId,
          signedCount,
          totalSignatories: allSignatories.length
        }
      }
    });

    res.json({
      message: 'Transaction signed successfully',
      transactionId: transaction.transactionId,
      status: newStatus,
      signedCount,
      totalSignatories: allSignatories.length,
      fullySignedDate: signedCount === allSignatories.length ? new Date() : null
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Sign error:', error);
    res.status(500).json({ error: 'Signing failed' });
  }
});

/**
 * POST /api/v1/transactions/:id/commit
 * Commit transaction to XDC blockchain
 */
router.post('/:id/commit', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;

    const transaction = await prisma.privateTransaction.findFirst({
      where: {
        OR: [{ id }, { transactionId: id }],
        parties: { some: { partyId: currentPartyId, role: 'SIGNATORY' } }
      },
      include: {
        parties: true,
        domain: true
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== TransactionStatus.FULLY_SIGNED) {
      return res.status(400).json({
        error: 'Transaction must be fully signed before committing',
        currentStatus: transaction.status
      });
    }

    if (transaction.commitmentTxHash) {
      return res.status(400).json({
        error: 'Transaction already committed',
        txHash: transaction.commitmentTxHash
      });
    }

    // Get blockchain service
    const blockchain = getBlockchainService();

    // Generate party hints (hashed public key identifiers)
    const partyHints = transaction.parties.map(p =>
      '0x' + hashPublicKey(p.encryptedDek.substring(0, 66))
    );

    // Get transaction type as number
    const txTypeMap: Record<string, number> = {
      TRADE_FINANCE: 0,
      RWA_TRANSFER: 1,
      DVP_SETTLEMENT: 2,
      PAYMENT: 3,
      CUSTOM: 4
    };

    // Record on-chain
    const result = await blockchain.recordCommitment({
      commitmentId: transaction.transactionId,
      commitmentHash: transaction.commitmentHash,
      domainId: transaction.domain.domainId,
      partyHints,
      txType: txTypeMap[transaction.txType] || 4
    });

    // Update transaction
    await prisma.privateTransaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.COMMITTED,
        commitmentTxHash: result.txHash,
        committedAt: new Date()
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'TRANSACTION_COMMITTED',
        actorId: currentPartyId,
        resourceType: 'PrivateTransaction',
        resourceId: transaction.id,
        details: {
          transactionId: transaction.transactionId,
          txHash: result.txHash,
          blockNumber: result.blockNumber
        }
      }
    });

    res.json({
      message: 'Transaction committed to XDC blockchain',
      transactionId: transaction.transactionId,
      commitmentHash: transaction.commitmentHash,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      committedAt: new Date()
    });
  } catch (error) {
    console.error('Commit error:', error);
    res.status(500).json({ error: 'Failed to commit transaction' });
  }
});

/**
 * GET /api/v1/transactions/:id/verify
 * Verify transaction against on-chain commitment
 */
router.get('/:id/verify', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;

    const transaction = await prisma.privateTransaction.findFirst({
      where: {
        OR: [{ id }, { transactionId: id }],
        parties: { some: { partyId: currentPartyId } }
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (!transaction.commitmentTxHash) {
      return res.status(400).json({
        error: 'Transaction not yet committed on-chain',
        status: transaction.status
      });
    }

    const blockchain = getBlockchainService();
    const isValid = await blockchain.verifyCommitment(
      transaction.transactionId,
      transaction.commitmentHash
    );

    res.json({
      transactionId: transaction.transactionId,
      commitmentHash: transaction.commitmentHash,
      txHash: transaction.commitmentTxHash,
      verified: isValid,
      verifiedAt: new Date()
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export { router as transactionRouter };

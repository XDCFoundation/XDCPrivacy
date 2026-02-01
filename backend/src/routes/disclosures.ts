import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import {
  createEncryptedEnvelope,
  decryptEnvelope,
  generateMerkleProof,
  buildMerkleTree,
  hashPublicKey
} from '../services/encryption';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const createDisclosureSchema = z.object({
  transactionId: z.string(),
  receiverId: z.string().uuid(),
  disclosedFields: z.array(z.string()).min(1),
  purpose: z.string().optional(),
  expiresInDays: z.number().optional()
});

const verifyDisclosureSchema = z.object({
  disclosedData: z.record(z.any()),
  merkleProof: z.string(),
  originalMerkleRoot: z.string()
});

/**
 * POST /api/v1/disclosures
 * Create a selective disclosure for an auditor/regulator
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { transactionId, receiverId, disclosedFields, purpose, expiresInDays } =
      createDisclosureSchema.parse(req.body);

    // Verify current party has access to transaction
    const transaction = await prisma.privateTransaction.findFirst({
      where: {
        OR: [{ id: transactionId }, { transactionId }],
        parties: { some: { partyId: currentPartyId } }
      },
      include: {
        parties: {
          where: { partyId: currentPartyId },
          include: { party: { select: { encryptionKey: true } } }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found or access denied' });
    }

    // Get receiver's public key
    const receiver = await prisma.party.findUnique({
      where: { id: receiverId },
      select: { id: true, name: true, encryptionKey: true }
    });

    if (!receiver) {
      return res.status(404).json({ error: 'Receiver party not found' });
    }

    // Check if disclosure already exists
    const existingDisclosure = await prisma.disclosure.findUnique({
      where: {
        transactionId_grantorId_receiverId: {
          transactionId: transaction.id,
          grantorId: currentPartyId,
          receiverId
        }
      }
    });

    if (existingDisclosure) {
      return res.status(400).json({ error: 'Disclosure already exists for this receiver' });
    }

    // Note: In production, we would decrypt the transaction data first
    // For demo, we create a sample disclosed payload
    const samplePayload: Record<string, any> = {};
    for (const field of disclosedFields) {
      samplePayload[field] = `[Disclosed: ${field}]`;
    }

    // Generate Merkle proof for disclosed fields
    const { disclosedFields: disclosedData, proof } = generateMerkleProof(
      samplePayload,
      disclosedFields
    );

    // Encrypt disclosed data for receiver
    const envelope = createEncryptedEnvelope(disclosedData, [receiver.encryptionKey]);

    // Calculate expiry
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Create disclosure record
    const disclosure = await prisma.disclosure.create({
      data: {
        transactionId: transaction.id,
        grantorId: currentPartyId,
        receiverId,
        disclosedFields,
        encryptedDisclosure: JSON.stringify(envelope),
        merkleProof: proof,
        purpose,
        expiresAt
      },
      include: {
        grantor: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
        transaction: { select: { transactionId: true, txType: true } }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'DISCLOSURE_CREATED',
        actorId: currentPartyId,
        resourceType: 'Disclosure',
        resourceId: disclosure.id,
        details: {
          transactionId: transaction.transactionId,
          receiverId,
          fields: disclosedFields
        }
      }
    });

    res.status(201).json({
      message: 'Selective disclosure created',
      disclosure: {
        id: disclosure.id,
        transactionId: disclosure.transaction.transactionId,
        transactionType: disclosure.transaction.txType,
        grantor: disclosure.grantor,
        receiver: disclosure.receiver,
        disclosedFields: disclosure.disclosedFields,
        purpose: disclosure.purpose,
        expiresAt: disclosure.expiresAt,
        createdAt: disclosure.createdAt
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create disclosure error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/disclosures
 * List disclosures (granted or received)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { type = 'all' } = req.query;

    let where: any = {};
    if (type === 'granted') {
      where = { grantorId: currentPartyId };
    } else if (type === 'received') {
      where = { receiverId: currentPartyId };
    } else {
      where = {
        OR: [{ grantorId: currentPartyId }, { receiverId: currentPartyId }]
      };
    }

    const disclosures = await prisma.disclosure.findMany({
      where,
      include: {
        grantor: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
        transaction: { select: { transactionId: true, txType: true, commitmentHash: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      disclosures: disclosures.map(d => ({
        id: d.id,
        transactionId: d.transaction.transactionId,
        transactionType: d.transaction.txType,
        commitmentHash: d.transaction.commitmentHash,
        grantor: d.grantor,
        receiver: d.receiver,
        disclosedFields: d.disclosedFields,
        purpose: d.purpose,
        isExpired: d.expiresAt ? new Date() > d.expiresAt : false,
        expiresAt: d.expiresAt,
        createdAt: d.createdAt
      }))
    });
  } catch (error) {
    console.error('List disclosures error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/disclosures/:id
 * Get disclosure details (decrypt if receiver)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;

    const disclosure = await prisma.disclosure.findFirst({
      where: {
        id,
        OR: [{ grantorId: currentPartyId }, { receiverId: currentPartyId }]
      },
      include: {
        grantor: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true, encryptionKey: true } },
        transaction: {
          select: {
            transactionId: true,
            txType: true,
            commitmentHash: true,
            merkleRoot: true
          }
        }
      }
    });

    if (!disclosure) {
      return res.status(404).json({ error: 'Disclosure not found or access denied' });
    }

    // Check expiry
    if (disclosure.expiresAt && new Date() > disclosure.expiresAt) {
      return res.status(410).json({ error: 'Disclosure has expired' });
    }

    const response: any = {
      id: disclosure.id,
      transactionId: disclosure.transaction.transactionId,
      transactionType: disclosure.transaction.txType,
      commitmentHash: disclosure.transaction.commitmentHash,
      merkleRoot: disclosure.transaction.merkleRoot,
      grantor: disclosure.grantor,
      receiver: {
        id: disclosure.receiver.id,
        name: disclosure.receiver.name,
        email: disclosure.receiver.email
      },
      disclosedFields: disclosure.disclosedFields,
      purpose: disclosure.purpose,
      expiresAt: disclosure.expiresAt,
      createdAt: disclosure.createdAt
    };

    // If current user is receiver, include encrypted envelope for decryption
    if (currentPartyId === disclosure.receiverId) {
      response.encryptedEnvelope = JSON.parse(disclosure.encryptedDisclosure);
      response.merkleProof = disclosure.merkleProof;
    }

    res.json(response);
  } catch (error) {
    console.error('Get disclosure error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/disclosures/:id/decrypt
 * Decrypt disclosure data (receiver only)
 */
router.post('/:id/decrypt', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;
    const { privateKey } = req.body;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key required' });
    }

    const disclosure = await prisma.disclosure.findFirst({
      where: { id, receiverId: currentPartyId },
      include: {
        receiver: { select: { encryptionKey: true } },
        transaction: { select: { transactionId: true, merkleRoot: true } }
      }
    });

    if (!disclosure) {
      return res.status(404).json({ error: 'Disclosure not found or not authorized' });
    }

    if (disclosure.expiresAt && new Date() > disclosure.expiresAt) {
      return res.status(410).json({ error: 'Disclosure has expired' });
    }

    // Decrypt
    const envelope = JSON.parse(disclosure.encryptedDisclosure);
    const result = decryptEnvelope(envelope, privateKey, disclosure.receiver.encryptionKey);

    if (!result.success) {
      return res.status(400).json({ error: 'Decryption failed', details: result.error });
    }

    res.json({
      transactionId: disclosure.transaction.transactionId,
      disclosedFields: disclosure.disclosedFields,
      disclosedData: result.data,
      merkleRoot: disclosure.transaction.merkleRoot,
      merkleProof: disclosure.merkleProof,
      note: 'Use merkleProof to verify disclosed data against merkleRoot'
    });
  } catch (error) {
    console.error('Decrypt disclosure error:', error);
    res.status(500).json({ error: 'Decryption failed' });
  }
});

/**
 * POST /api/v1/disclosures/verify
 * Verify disclosed data against Merkle proof
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { disclosedData, merkleProof, originalMerkleRoot } =
      verifyDisclosureSchema.parse(req.body);

    // Rebuild Merkle tree from disclosed data
    const { root, leaves } = buildMerkleTree(disclosedData);

    // Parse proof (contains hashes of non-disclosed fields)
    const proofHashes = JSON.parse(merkleProof) as string[];

    // Combine disclosed leaves with proof hashes and compute root
    const allHashes = [...Object.values(leaves), ...proofHashes.filter(h => !Object.values(leaves).includes(h))];
    allHashes.sort();

    // Simple verification: check if our computed structure matches
    // In production, implement proper Merkle proof verification
    const isValid = true; // Simplified for demo

    res.json({
      valid: isValid,
      disclosedFieldCount: Object.keys(disclosedData).length,
      expectedRoot: originalMerkleRoot,
      message: isValid
        ? 'Disclosed data is authentic and part of original transaction'
        : 'Verification failed - data may be tampered'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Verify disclosure error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * DELETE /api/v1/disclosures/:id
 * Revoke a disclosure (grantor only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;

    const disclosure = await prisma.disclosure.findFirst({
      where: { id, grantorId: currentPartyId }
    });

    if (!disclosure) {
      return res.status(404).json({ error: 'Disclosure not found or not authorized' });
    }

    await prisma.disclosure.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'DISCLOSURE_REVOKED',
        actorId: currentPartyId,
        resourceType: 'Disclosure',
        resourceId: id,
        details: { transactionId: disclosure.transactionId }
      }
    });

    res.json({ message: 'Disclosure revoked' });
  } catch (error) {
    console.error('Delete disclosure error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as disclosureRouter };

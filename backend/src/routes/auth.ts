import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { generateKeyPair, hashPublicKey } from '../services/encryption';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'xdc-canton-privacy-secret';

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

/**
 * POST /api/v1/auth/register
 * Register a new party with auto-generated key pair
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    // Check if email already exists
    const existingParty = await prisma.party.findUnique({ where: { email } });
    if (existingParty) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate key pairs
    const identityKeyPair = generateKeyPair();
    const encryptionKeyPair = generateKeyPair();

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create party
    const party = await prisma.party.create({
      data: {
        name,
        email,
        passwordHash,
        publicKey: identityKeyPair.publicKey,
        encryptionKey: encryptionKeyPair.publicKey
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { partyId: party.id, email: party.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // IMPORTANT: Return private keys ONLY during registration
    // User must store these securely - they are never stored on server
    res.status(201).json({
      message: 'Party registered successfully',
      party: {
        id: party.id,
        name: party.name,
        email: party.email,
        publicKey: party.publicKey,
        encryptionKey: party.encryptionKey,
        publicKeyHash: hashPublicKey(party.publicKey)
      },
      keys: {
        warning: 'SAVE THESE PRIVATE KEYS SECURELY - THEY CANNOT BE RECOVERED',
        identityPrivateKey: identityKeyPair.privateKey,
        encryptionPrivateKey: encryptionKeyPair.privateKey
      },
      token
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate and receive JWT token
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const party = await prisma.party.findUnique({ where: { email } });
    if (!party) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, party.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { partyId: party.id, email: party.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      party: {
        id: party.id,
        name: party.name,
        email: party.email,
        publicKey: party.publicKey,
        encryptionKey: party.encryptionKey
      },
      token
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current party info (requires auth)
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { partyId: string };

    const party = await prisma.party.findUnique({
      where: { id: decoded.partyId },
      select: {
        id: true,
        name: true,
        email: true,
        publicKey: true,
        encryptionKey: true,
        createdAt: true,
        _count: {
          select: {
            domainMemberships: true,
            transactionParties: true
          }
        }
      }
    });

    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    res.json({
      ...party,
      publicKeyHash: hashPublicKey(party.publicKey)
    });
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/auth/keys
 * Get party's public keys (for other parties to encrypt data for them)
 */
router.get('/keys/:partyId', async (req: Request, res: Response) => {
  try {
    const party = await prisma.party.findUnique({
      where: { id: req.params.partyId },
      select: {
        id: true,
        name: true,
        publicKey: true,
        encryptionKey: true
      }
    });

    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    res.json({
      partyId: party.id,
      name: party.name,
      publicKey: party.publicKey,
      encryptionKey: party.encryptionKey,
      publicKeyHash: hashPublicKey(party.publicKey)
    });
  } catch (error) {
    console.error('Get keys error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/auth/lookup
 * Lookup party by email (to find public keys)
 */
router.get('/lookup', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const party = await prisma.party.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        publicKey: true,
        encryptionKey: true
      }
    });

    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    res.json({
      partyId: party.id,
      name: party.name,
      publicKey: party.publicKey,
      encryptionKey: party.encryptionKey,
      publicKeyHash: hashPublicKey(party.publicKey)
    });
  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as authRouter };

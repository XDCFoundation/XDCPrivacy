import { Router, Request, Response } from 'express';
import { PrismaClient, MemberRole } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';
import { getBlockchainService, BlockchainService } from '../services/blockchain';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const createDomainSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional()
});

const inviteSchema = z.object({
  partyId: z.string().uuid(),
  role: z.enum(['MEMBER', 'OBSERVER', 'AUDITOR']).default('MEMBER')
});

/**
 * POST /api/v1/domains
 * Create a new privacy domain
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { name, description } = createDomainSchema.parse(req.body);

    // Generate unique domain ID
    const domainId = BlockchainService.keccak256(`${name}-${Date.now()}-${uuidv4()}`);

    // Create domain in database
    const domain = await prisma.domain.create({
      data: {
        domainId,
        name,
        description,
        adminId: currentPartyId,
        members: {
          create: {
            partyId: currentPartyId,
            role: MemberRole.ADMIN
          }
        }
      },
      include: {
        admin: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            party: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    // Register on-chain (in background)
    const blockchain = getBlockchainService();
    blockchain.registerDomain(domainId, name).then(async (result) => {
      await prisma.domain.update({
        where: { id: domain.id },
        data: { registrationTxHash: result.txHash }
      });
    }).catch(err => {
      console.error('Failed to register domain on-chain:', err);
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'DOMAIN_CREATED',
        actorId: currentPartyId,
        resourceType: 'Domain',
        resourceId: domain.id,
        details: { domainId, name }
      }
    });

    res.status(201).json({
      message: 'Privacy domain created',
      domain: {
        id: domain.id,
        domainId: domain.domainId,
        name: domain.name,
        description: domain.description,
        admin: domain.admin,
        members: domain.members.map(m => ({
          partyId: m.party.id,
          name: m.party.name,
          role: m.role
        })),
        createdAt: domain.createdAt
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create domain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/domains
 * List domains the current party belongs to
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;

    const domains = await prisma.domain.findMany({
      where: {
        members: { some: { partyId: currentPartyId } }
      },
      include: {
        admin: { select: { id: true, name: true } },
        members: {
          include: {
            party: { select: { id: true, name: true } }
          }
        },
        _count: { select: { transactions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      domains: domains.map(d => ({
        id: d.id,
        domainId: d.domainId,
        name: d.name,
        description: d.description,
        admin: d.admin,
        memberCount: d.members.length,
        transactionCount: d._count.transactions,
        myRole: d.members.find(m => m.partyId === currentPartyId)?.role,
        isActive: d.isActive,
        createdAt: d.createdAt
      }))
    });
  } catch (error) {
    console.error('List domains error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/domains/:id
 * Get domain details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;

    const domain = await prisma.domain.findFirst({
      where: {
        OR: [{ id }, { domainId: id }],
        members: { some: { partyId: currentPartyId } }
      },
      include: {
        admin: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            party: { select: { id: true, name: true, email: true, publicKey: true } }
          }
        },
        _count: { select: { transactions: true } }
      }
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found or access denied' });
    }

    res.json({
      id: domain.id,
      domainId: domain.domainId,
      name: domain.name,
      description: domain.description,
      admin: domain.admin,
      members: domain.members.map(m => ({
        partyId: m.party.id,
        name: m.party.name,
        email: m.party.email,
        role: m.role,
        joinedAt: m.joinedAt
      })),
      transactionCount: domain._count.transactions,
      registrationTxHash: domain.registrationTxHash,
      isActive: domain.isActive,
      createdAt: domain.createdAt
    });
  } catch (error) {
    console.error('Get domain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/domains/:id/invite
 * Invite a party to the domain (admin only)
 */
router.post('/:id/invite', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id } = req.params;
    const { partyId, role } = inviteSchema.parse(req.body);

    // Verify domain exists and user is admin
    const domain = await prisma.domain.findFirst({
      where: {
        OR: [{ id }, { domainId: id }],
        adminId: currentPartyId
      }
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found or not admin' });
    }

    // Check if party exists
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    // Check if already a member
    const existingMember = await prisma.domainMember.findUnique({
      where: { domainId_partyId: { domainId: domain.id, partyId } }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'Party is already a member' });
    }

    // Add member
    const member = await prisma.domainMember.create({
      data: {
        domainId: domain.id,
        partyId,
        role: role as MemberRole
      },
      include: {
        party: { select: { id: true, name: true, email: true } }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'MEMBER_INVITED',
        actorId: currentPartyId,
        resourceType: 'Domain',
        resourceId: domain.id,
        details: { partyId, role }
      }
    });

    res.status(201).json({
      message: 'Party added to domain',
      member: {
        partyId: member.party.id,
        name: member.party.name,
        email: member.party.email,
        role: member.role,
        joinedAt: member.joinedAt
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/v1/domains/:id/members/:partyId
 * Remove a member from the domain
 */
router.delete('/:id/members/:partyId', async (req: Request, res: Response) => {
  try {
    const currentPartyId = (req as any).partyId;
    const { id, partyId } = req.params;

    // Verify domain and admin status
    const domain = await prisma.domain.findFirst({
      where: {
        OR: [{ id }, { domainId: id }],
        adminId: currentPartyId
      }
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found or not admin' });
    }

    if (partyId === currentPartyId) {
      return res.status(400).json({ error: 'Cannot remove yourself as admin' });
    }

    await prisma.domainMember.delete({
      where: { domainId_partyId: { domainId: domain.id, partyId } }
    });

    res.json({ message: 'Member removed from domain' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as domainRouter };

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getBlockchainService } from '../services/blockchain';
import { verifyCommitment as verifyCryptoCommitment } from '../services/encryption';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/commitments/status
 * Get blockchain connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const blockchain = getBlockchainService();
    const status = await blockchain.checkConnection();
    const gasPrice = await blockchain.getGasPrice();
    const walletAddress = blockchain.getWalletAddress();
    
    let balance = '0';
    if (walletAddress) {
      balance = await blockchain.getBalance();
    }

    res.json({
      blockchain: {
        connected: status.connected,
        network: 'XDC Apothem Testnet',
        chainId: status.chainId,
        blockNumber: status.blockNumber,
        rpcUrl: blockchain.getRpcUrl()
      },
      wallet: walletAddress ? {
        address: walletAddress,
        balance: `${balance} XDC`
      } : null,
      gas: {
        price: `${gasPrice} Gwei`
      }
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to get blockchain status' });
  }
});

/**
 * GET /api/v1/commitments/:hash
 * Get commitment details from database and optionally verify on-chain
 */
router.get('/:hash', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    const { verify } = req.query;

    // Find transaction by commitment hash
    const transaction = await prisma.privateTransaction.findFirst({
      where: { commitmentHash: hash },
      select: {
        id: true,
        transactionId: true,
        commitmentHash: true,
        commitmentTxHash: true,
        txType: true,
        status: true,
        createdAt: true,
        committedAt: true,
        domain: {
          select: { id: true, name: true, domainId: true }
        },
        parties: {
          select: {
            role: true,
            signature: true,
            party: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Commitment not found' });
    }

    let onChainVerified = null;
    if (verify === 'true' && transaction.commitmentTxHash) {
      const blockchain = getBlockchainService();
      onChainVerified = await blockchain.verifyCommitment(
        transaction.transactionId,
        transaction.commitmentHash
      );
    }

    res.json({
      commitmentHash: transaction.commitmentHash,
      transactionId: transaction.transactionId,
      type: transaction.txType,
      status: transaction.status,
      domain: transaction.domain,
      partyCount: transaction.parties.length,
      signatoryCount: transaction.parties.filter(p => p.role === 'SIGNATORY').length,
      signedCount: transaction.parties.filter(p => p.signature).length,
      onChain: {
        committed: !!transaction.commitmentTxHash,
        txHash: transaction.commitmentTxHash,
        committedAt: transaction.committedAt,
        verified: onChainVerified
      },
      createdAt: transaction.createdAt
    });
  } catch (error) {
    console.error('Get commitment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/commitments/verify
 * Verify that data matches a commitment hash
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { data, nonce, expectedCommitment } = req.body;

    if (!data || !nonce || !expectedCommitment) {
      return res.status(400).json({
        error: 'Missing required fields: data, nonce, expectedCommitment'
      });
    }

    const isValid = verifyCryptoCommitment(data, nonce, expectedCommitment);

    // Check if this commitment exists in our database
    const transaction = await prisma.privateTransaction.findFirst({
      where: { commitmentHash: expectedCommitment },
      select: {
        transactionId: true,
        status: true,
        commitmentTxHash: true
      }
    });

    res.json({
      valid: isValid,
      expectedCommitment,
      knownTransaction: transaction ? {
        transactionId: transaction.transactionId,
        status: transaction.status,
        onChain: !!transaction.commitmentTxHash
      } : null,
      message: isValid
        ? 'Data matches the commitment hash'
        : 'Data does not match the commitment hash'
    });
  } catch (error) {
    console.error('Verify commitment error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * GET /api/v1/commitments/stats
 * Get commitment statistics
 */
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const [
      totalTransactions,
      committedTransactions,
      pendingTransactions,
      totalDomains,
      totalParties
    ] = await Promise.all([
      prisma.privateTransaction.count(),
      prisma.privateTransaction.count({ where: { status: 'COMMITTED' } }),
      prisma.privateTransaction.count({ where: { status: 'PENDING' } }),
      prisma.domain.count(),
      prisma.party.count()
    ]);

    // Get transaction type breakdown
    const typeBreakdown = await prisma.privateTransaction.groupBy({
      by: ['txType'],
      _count: { txType: true }
    });

    res.json({
      transactions: {
        total: totalTransactions,
        committed: committedTransactions,
        pending: pendingTransactions,
        byType: typeBreakdown.reduce((acc, item) => {
          acc[item.txType] = item._count.txType;
          return acc;
        }, {} as Record<string, number>)
      },
      domains: totalDomains,
      parties: totalParties
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export { router as commitmentRouter };

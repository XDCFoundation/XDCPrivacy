import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Contract ABIs (simplified for demo)
const COMMITMENT_REGISTRY_ABI = [
  "function recordCommitment(bytes32 commitmentId, bytes32 commitmentHash, bytes32 domainId, bytes32[] partyHints, uint8 txType) external",
  "function verifyCommitment(bytes32 commitmentId, bytes32 expectedHash) external view returns (bool)",
  "function getCommitment(bytes32 commitmentId) external view returns (tuple(bytes32 commitmentHash, bytes32 domainId, bytes32[] partyHints, uint256 timestamp, uint8 txType, bool exists))",
  "event CommitmentRecorded(bytes32 indexed commitmentId, bytes32 indexed domainId, bytes32 commitmentHash, uint256 timestamp)"
];

const DOMAIN_REGISTRY_ABI = [
  "function registerDomain(bytes32 domainId, string name) external",
  "function addParticipant(bytes32 domainId, bytes32 participantHint) external",
  "function removeParticipant(bytes32 domainId, bytes32 participantHint) external",
  "function getDomain(bytes32 domainId) external view returns (tuple(address admin, bool active, uint256 createdAt, uint256 participantCount))",
  "function isParticipant(bytes32 domainId, bytes32 participantHint) external view returns (bool)",
  "event DomainRegistered(bytes32 indexed domainId, address indexed admin, string name)",
  "event ParticipantAdded(bytes32 indexed domainId, bytes32 participantHint)"
];

export interface CommitmentData {
  commitmentId: string;
  commitmentHash: string;
  domainId: string;
  partyHints: string[];
  txType: number;
}

export interface BlockchainConfig {
  rpcUrl: string;
  chainId: number;
  commitmentRegistryAddress?: string;
  domainRegistryAddress?: string;
  privateKey?: string;
}

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private commitmentRegistry?: ethers.Contract;
  private domainRegistry?: ethers.Contract;
  private config: BlockchainConfig;

  constructor(config?: Partial<BlockchainConfig>) {
    this.config = {
      rpcUrl: config?.rpcUrl || process.env.XDC_RPC_URL || 'https://rpc.apothem.network',
      chainId: config?.chainId || parseInt(process.env.XDC_CHAIN_ID || '51'),
      commitmentRegistryAddress: config?.commitmentRegistryAddress || process.env.COMMITMENT_REGISTRY_ADDRESS,
      domainRegistryAddress: config?.domainRegistryAddress || process.env.DOMAIN_REGISTRY_ADDRESS,
      privateKey: config?.privateKey || process.env.PRIVATE_KEY
    };

    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    
    if (this.config.privateKey) {
      this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
    }

    if (this.config.commitmentRegistryAddress && this.wallet) {
      this.commitmentRegistry = new ethers.Contract(
        this.config.commitmentRegistryAddress,
        COMMITMENT_REGISTRY_ABI,
        this.wallet
      );
    }

    if (this.config.domainRegistryAddress && this.wallet) {
      this.domainRegistry = new ethers.Contract(
        this.config.domainRegistryAddress,
        DOMAIN_REGISTRY_ABI,
        this.wallet
      );
    }
  }

  /**
   * Check connection to XDC network
   */
  async checkConnection(): Promise<{ connected: boolean; blockNumber?: number; chainId?: number }> {
    try {
      const [blockNumber, network] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getNetwork()
      ]);
      return {
        connected: true,
        blockNumber,
        chainId: Number(network.chainId)
      };
    } catch (error) {
      return { connected: false };
    }
  }

  /**
   * Record commitment on-chain
   */
  async recordCommitment(data: CommitmentData): Promise<{ txHash: string; blockNumber: number }> {
    if (!this.commitmentRegistry) {
      // In demo mode without deployed contract, simulate the response
      console.log('⚠️ Demo mode: Simulating on-chain commitment');
      return {
        txHash: '0x' + Buffer.from(data.commitmentId).toString('hex').padStart(64, '0'),
        blockNumber: await this.provider.getBlockNumber()
      };
    }

    const tx = await this.commitmentRegistry.recordCommitment(
      ethers.zeroPadValue(ethers.toBeHex(data.commitmentId), 32),
      data.commitmentHash,
      ethers.zeroPadValue(ethers.toBeHex(data.domainId), 32),
      data.partyHints.map(h => ethers.zeroPadValue(ethers.toBeHex(h), 32)),
      data.txType
    );

    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }

  /**
   * Verify commitment on-chain
   */
  async verifyCommitment(commitmentId: string, expectedHash: string): Promise<boolean> {
    if (!this.commitmentRegistry) {
      console.log('⚠️ Demo mode: Commitment verification simulated as true');
      return true;
    }

    return await this.commitmentRegistry.verifyCommitment(
      ethers.zeroPadValue(ethers.toBeHex(commitmentId), 32),
      expectedHash
    );
  }

  /**
   * Get commitment details from chain
   */
  async getCommitment(commitmentId: string): Promise<any> {
    if (!this.commitmentRegistry) {
      return null;
    }

    return await this.commitmentRegistry.getCommitment(
      ethers.zeroPadValue(ethers.toBeHex(commitmentId), 32)
    );
  }

  /**
   * Register a new privacy domain on-chain
   */
  async registerDomain(domainId: string, name: string): Promise<{ txHash: string }> {
    if (!this.domainRegistry) {
      console.log('⚠️ Demo mode: Simulating domain registration');
      return {
        txHash: '0x' + Buffer.from(domainId).toString('hex').padStart(64, '0')
      };
    }

    const tx = await this.domainRegistry.registerDomain(
      ethers.zeroPadValue(ethers.toBeHex(domainId), 32),
      name
    );

    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  }

  /**
   * Add participant hint to domain
   */
  async addDomainParticipant(domainId: string, participantHint: string): Promise<{ txHash: string }> {
    if (!this.domainRegistry) {
      console.log('⚠️ Demo mode: Simulating participant addition');
      return { txHash: '0x' + 'demo'.padStart(64, '0') };
    }

    const tx = await this.domainRegistry.addParticipant(
      ethers.zeroPadValue(ethers.toBeHex(domainId), 32),
      ethers.zeroPadValue(ethers.toBeHex(participantHint), 32)
    );

    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    const feeData = await this.provider.getFeeData();
    return ethers.formatUnits(feeData.gasPrice || 0n, 'gwei');
  }

  /**
   * Get wallet balance
   */
  async getBalance(address?: string): Promise<string> {
    const addr = address || this.wallet?.address;
    if (!addr) return '0';
    
    const balance = await this.provider.getBalance(addr);
    return ethers.formatEther(balance);
  }

  /**
   * Generate bytes32 from string
   */
  static stringToBytes32(str: string): string {
    return ethers.encodeBytes32String(str.substring(0, 31));
  }

  /**
   * Generate keccak256 hash
   */
  static keccak256(data: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }

  /**
   * Get the wallet address
   */
  getWalletAddress(): string | undefined {
    return this.wallet?.address;
  }

  /**
   * Get provider URL
   */
  getRpcUrl(): string {
    return this.config.rpcUrl;
  }
}

// Singleton instance
let blockchainService: BlockchainService | null = null;

export function getBlockchainService(): BlockchainService {
  if (!blockchainService) {
    blockchainService = new BlockchainService();
  }
  return blockchainService;
}

export default BlockchainService;

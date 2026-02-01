import crypto from 'crypto';
import { ec as EC } from 'elliptic';
import { keccak256 } from 'js-sha3';

const ec = new EC('secp256k1');

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export interface EncryptedEnvelope {
  encryptedData: string;
  iv: string;
  authTag: string;
  encryptedKeys: Record<string, string>; // partyPubKeyHash -> encrypted DEK
}

export interface DecryptionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Generate a new secp256k1 key pair for identity
 */
export function generateKeyPair(): KeyPair {
  const keyPair = ec.genKeyPair();
  return {
    privateKey: keyPair.getPrivate('hex'),
    publicKey: keyPair.getPublic('hex')
  };
}

/**
 * Generate a random AES-256 Data Encryption Key
 */
export function generateDEK(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * Hash a public key for use as identifier
 */
export function hashPublicKey(publicKey: string): string {
  return keccak256(Buffer.from(publicKey, 'hex')).substring(0, 40);
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encryptWithAES(data: string, key: Buffer): { ciphertext: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let ciphertext = cipher.update(data, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decryptWithAES(ciphertext: string, key: Buffer, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}

/**
 * Encrypt DEK for a specific party using ECIES-like scheme
 * Uses ECDH to derive shared secret, then AES to encrypt the DEK
 */
export function encryptDEKForParty(dek: Buffer, partyPublicKey: string, ephemeralPrivateKey?: string): string {
  // Generate ephemeral key pair if not provided
  const ephemeral = ephemeralPrivateKey 
    ? ec.keyFromPrivate(ephemeralPrivateKey, 'hex')
    : ec.genKeyPair();
  
  // Derive shared secret using ECDH
  const partyKey = ec.keyFromPublic(partyPublicKey, 'hex');
  const sharedSecret = ephemeral.derive(partyKey.getPublic());
  
  // Derive encryption key from shared secret
  const encryptionKey = crypto.createHash('sha256')
    .update(Buffer.from(sharedSecret.toArray()))
    .digest();
  
  // Encrypt DEK with derived key
  const { ciphertext, iv, authTag } = encryptWithAES(dek.toString('hex'), encryptionKey);
  
  // Return ephemeral public key + encrypted DEK
  const ephemeralPub = ephemeral.getPublic('hex');
  return JSON.stringify({
    ephemeralPublicKey: ephemeralPub,
    encryptedDek: ciphertext,
    iv,
    authTag
  });
}

/**
 * Decrypt DEK using party's private key
 */
export function decryptDEKWithPrivateKey(encryptedDekJson: string, privateKey: string): Buffer {
  const { ephemeralPublicKey, encryptedDek, iv, authTag } = JSON.parse(encryptedDekJson);
  
  // Derive shared secret
  const partyKey = ec.keyFromPrivate(privateKey, 'hex');
  const ephemeralKey = ec.keyFromPublic(ephemeralPublicKey, 'hex');
  const sharedSecret = partyKey.derive(ephemeralKey.getPublic());
  
  // Derive decryption key
  const decryptionKey = crypto.createHash('sha256')
    .update(Buffer.from(sharedSecret.toArray()))
    .digest();
  
  // Decrypt DEK
  const dekHex = decryptWithAES(encryptedDek, decryptionKey, iv, authTag);
  return Buffer.from(dekHex, 'hex');
}

/**
 * Create encrypted envelope for multiple parties
 */
export function createEncryptedEnvelope(
  data: any,
  partyPublicKeys: string[]
): EncryptedEnvelope {
  // Generate random DEK
  const dek = generateDEK();
  
  // Encrypt data with DEK
  const jsonData = JSON.stringify(data);
  const { ciphertext, iv, authTag } = encryptWithAES(jsonData, dek);
  
  // Encrypt DEK for each party
  const encryptedKeys: Record<string, string> = {};
  for (const pubKey of partyPublicKeys) {
    const keyHash = hashPublicKey(pubKey);
    encryptedKeys[keyHash] = encryptDEKForParty(dek, pubKey);
  }
  
  return {
    encryptedData: ciphertext,
    iv,
    authTag,
    encryptedKeys
  };
}

/**
 * Decrypt envelope using party's private key
 */
export function decryptEnvelope(
  envelope: EncryptedEnvelope,
  privateKey: string,
  publicKey: string
): DecryptionResult {
  try {
    const keyHash = hashPublicKey(publicKey);
    const encryptedDek = envelope.encryptedKeys[keyHash];
    
    if (!encryptedDek) {
      return { success: false, error: 'Not authorized to decrypt this data' };
    }
    
    // Decrypt DEK
    const dek = decryptDEKWithPrivateKey(encryptedDek, privateKey);
    
    // Decrypt data
    const jsonData = decryptWithAES(
      envelope.encryptedData,
      dek,
      envelope.iv,
      envelope.authTag
    );
    
    return { success: true, data: JSON.parse(jsonData) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate commitment hash for transaction data
 */
export function generateCommitment(data: any, nonce?: string): { commitment: string; nonce: string } {
  const txNonce = nonce || crypto.randomBytes(32).toString('hex');
  const dataString = JSON.stringify(data) + txNonce;
  const commitment = '0x' + keccak256(dataString);
  return { commitment, nonce: txNonce };
}

/**
 * Verify commitment matches data
 */
export function verifyCommitment(data: any, nonce: string, expectedCommitment: string): boolean {
  const { commitment } = generateCommitment(data, nonce);
  return commitment.toLowerCase() === expectedCommitment.toLowerCase();
}

/**
 * Sign data with private key
 */
export function signData(data: string, privateKey: string): string {
  const key = ec.keyFromPrivate(privateKey, 'hex');
  const hash = keccak256(data);
  const signature = key.sign(hash);
  return signature.toDER('hex');
}

/**
 * Verify signature
 */
export function verifySignature(data: string, signature: string, publicKey: string): boolean {
  try {
    const key = ec.keyFromPublic(publicKey, 'hex');
    const hash = keccak256(data);
    return key.verify(hash, signature);
  } catch {
    return false;
  }
}

/**
 * Build Merkle tree for selective disclosure
 */
export function buildMerkleTree(fields: Record<string, any>): { root: string; leaves: Record<string, string> } {
  const leaves: Record<string, string> = {};
  const hashes: string[] = [];
  
  // Create leaf hashes for each field
  for (const [key, value] of Object.entries(fields)) {
    const leafData = `${key}:${JSON.stringify(value)}`;
    const leafHash = keccak256(leafData);
    leaves[key] = leafHash;
    hashes.push(leafHash);
  }
  
  // Build tree (simplified - just hash all leaves together for demo)
  if (hashes.length === 0) {
    return { root: keccak256(''), leaves };
  }
  
  // Sort hashes for deterministic root
  hashes.sort();
  const root = keccak256(hashes.join(''));
  
  return { root: '0x' + root, leaves };
}

/**
 * Generate Merkle proof for specific fields
 */
export function generateMerkleProof(
  allFields: Record<string, any>,
  disclosedFieldNames: string[]
): { disclosedFields: Record<string, any>; proof: string } {
  const { leaves } = buildMerkleTree(allFields);
  
  const disclosedFields: Record<string, any> = {};
  const proofHashes: string[] = [];
  
  for (const fieldName of disclosedFieldNames) {
    if (allFields[fieldName] !== undefined) {
      disclosedFields[fieldName] = allFields[fieldName];
      proofHashes.push(leaves[fieldName]);
    }
  }
  
  // Include non-disclosed field hashes in proof (for verification)
  for (const [key, hash] of Object.entries(leaves)) {
    if (!disclosedFieldNames.includes(key)) {
      proofHashes.push(hash);
    }
  }
  
  proofHashes.sort();
  const proof = JSON.stringify(proofHashes);
  
  return { disclosedFields, proof };
}

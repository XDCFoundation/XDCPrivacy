// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PrivacyCommitmentRegistry
 * @notice Records commitments for private transactions on XDC Network
 * @dev Implements Canton-style privacy where only hash commitments are stored on-chain
 */
contract PrivacyCommitmentRegistry {
    
    struct Commitment {
        bytes32 commitmentHash;     // SHA3-256 hash of transaction data
        bytes32 domainId;           // Privacy domain this belongs to
        bytes32[] partyHints;       // Encrypted hints for party discovery
        uint256 timestamp;          // Block timestamp when recorded
        uint8 txType;               // Transaction type enum
        bool exists;                // Whether commitment exists
    }
    
    // Commitment ID => Commitment data
    mapping(bytes32 => Commitment) public commitments;
    
    // Domain ID => Array of commitment IDs
    mapping(bytes32 => bytes32[]) public domainCommitments;
    
    // Party hint => Array of commitment IDs (for party discovery)
    mapping(bytes32 => bytes32[]) public partyCommitments;
    
    // Total commitments counter
    uint256 public totalCommitments;
    
    // Events
    event CommitmentRecorded(
        bytes32 indexed commitmentId,
        bytes32 indexed domainId,
        bytes32 commitmentHash,
        uint256 timestamp
    );
    
    event CommitmentVerified(
        bytes32 indexed commitmentId,
        bool verified,
        uint256 timestamp
    );
    
    /**
     * @notice Record a new commitment on-chain
     * @param commitmentId Unique identifier for this commitment
     * @param commitmentHash The hash of the transaction data
     * @param domainId The privacy domain this transaction belongs to
     * @param partyHints Encrypted identifiers for involved parties
     * @param txType Type of transaction (0=TRADE_FINANCE, 1=RWA_TRANSFER, etc.)
     */
    function recordCommitment(
        bytes32 commitmentId,
        bytes32 commitmentHash,
        bytes32 domainId,
        bytes32[] calldata partyHints,
        uint8 txType
    ) external {
        require(!commitments[commitmentId].exists, "Commitment already exists");
        require(commitmentHash != bytes32(0), "Invalid commitment hash");
        require(domainId != bytes32(0), "Invalid domain ID");
        
        commitments[commitmentId] = Commitment({
            commitmentHash: commitmentHash,
            domainId: domainId,
            partyHints: partyHints,
            timestamp: block.timestamp,
            txType: txType,
            exists: true
        });
        
        // Index by domain
        domainCommitments[domainId].push(commitmentId);
        
        // Index by party hints for discovery
        for (uint i = 0; i < partyHints.length; i++) {
            partyCommitments[partyHints[i]].push(commitmentId);
        }
        
        totalCommitments++;
        
        emit CommitmentRecorded(commitmentId, domainId, commitmentHash, block.timestamp);
    }
    
    /**
     * @notice Verify a commitment hash matches the stored value
     * @param commitmentId The commitment to verify
     * @param expectedHash The expected hash value
     * @return bool Whether the hash matches
     */
    function verifyCommitment(
        bytes32 commitmentId,
        bytes32 expectedHash
    ) external view returns (bool) {
        Commitment storage c = commitments[commitmentId];
        if (!c.exists) return false;
        return c.commitmentHash == expectedHash;
    }
    
    /**
     * @notice Get full commitment details
     * @param commitmentId The commitment to retrieve
     */
    function getCommitment(bytes32 commitmentId) external view returns (
        bytes32 commitmentHash,
        bytes32 domainId,
        bytes32[] memory partyHints,
        uint256 timestamp,
        uint8 txType,
        bool exists
    ) {
        Commitment storage c = commitments[commitmentId];
        return (
            c.commitmentHash,
            c.domainId,
            c.partyHints,
            c.timestamp,
            c.txType,
            c.exists
        );
    }
    
    /**
     * @notice Get all commitments for a domain
     * @param domainId The domain to query
     */
    function getCommitmentsByDomain(bytes32 domainId) external view returns (bytes32[] memory) {
        return domainCommitments[domainId];
    }
    
    /**
     * @notice Get all commitments for a party hint
     * @param partyHint The encrypted party identifier
     */
    function getCommitmentsByParty(bytes32 partyHint) external view returns (bytes32[] memory) {
        return partyCommitments[partyHint];
    }
    
    /**
     * @notice Check if a commitment exists
     * @param commitmentId The commitment to check
     */
    function commitmentExists(bytes32 commitmentId) external view returns (bool) {
        return commitments[commitmentId].exists;
    }
}

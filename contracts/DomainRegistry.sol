// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DomainRegistry
 * @notice Registry for Privacy Domains on XDC Network
 * @dev Privacy Domains are isolated environments for private transactions
 */
contract DomainRegistry {
    
    struct Domain {
        address admin;              // Domain administrator
        string name;                // Human-readable name
        bool active;                // Whether domain is active
        uint256 createdAt;          // Creation timestamp
        uint256 participantCount;   // Number of participants
    }
    
    // Domain ID => Domain data
    mapping(bytes32 => Domain) public domains;
    
    // Domain ID => Participant hint => is participant
    mapping(bytes32 => mapping(bytes32 => bool)) public isParticipant;
    
    // Domain ID => Array of participant hints
    mapping(bytes32 => bytes32[]) public domainParticipants;
    
    // Admin address => Array of domain IDs they manage
    mapping(address => bytes32[]) public adminDomains;
    
    // Total domains counter
    uint256 public totalDomains;
    
    // Events
    event DomainRegistered(
        bytes32 indexed domainId,
        address indexed admin,
        string name
    );
    
    event ParticipantAdded(
        bytes32 indexed domainId,
        bytes32 participantHint
    );
    
    event ParticipantRemoved(
        bytes32 indexed domainId,
        bytes32 participantHint
    );
    
    event DomainDeactivated(
        bytes32 indexed domainId
    );
    
    // Modifiers
    modifier onlyDomainAdmin(bytes32 domainId) {
        require(domains[domainId].admin == msg.sender, "Not domain admin");
        _;
    }
    
    modifier domainExists(bytes32 domainId) {
        require(domains[domainId].createdAt > 0, "Domain does not exist");
        _;
    }
    
    modifier domainActive(bytes32 domainId) {
        require(domains[domainId].active, "Domain is not active");
        _;
    }
    
    /**
     * @notice Register a new privacy domain
     * @param domainId Unique identifier for the domain
     * @param name Human-readable name for the domain
     */
    function registerDomain(bytes32 domainId, string calldata name) external {
        require(domains[domainId].createdAt == 0, "Domain already exists");
        require(bytes(name).length > 0, "Name cannot be empty");
        
        domains[domainId] = Domain({
            admin: msg.sender,
            name: name,
            active: true,
            createdAt: block.timestamp,
            participantCount: 0
        });
        
        adminDomains[msg.sender].push(domainId);
        totalDomains++;
        
        emit DomainRegistered(domainId, msg.sender, name);
    }
    
    /**
     * @notice Add a participant to the domain
     * @param domainId The domain to add participant to
     * @param participantHint Encrypted identifier for the participant
     */
    function addParticipant(
        bytes32 domainId,
        bytes32 participantHint
    ) external onlyDomainAdmin(domainId) domainActive(domainId) {
        require(!isParticipant[domainId][participantHint], "Already a participant");
        
        isParticipant[domainId][participantHint] = true;
        domainParticipants[domainId].push(participantHint);
        domains[domainId].participantCount++;
        
        emit ParticipantAdded(domainId, participantHint);
    }
    
    /**
     * @notice Remove a participant from the domain
     * @param domainId The domain to remove participant from
     * @param participantHint Encrypted identifier for the participant
     */
    function removeParticipant(
        bytes32 domainId,
        bytes32 participantHint
    ) external onlyDomainAdmin(domainId) {
        require(isParticipant[domainId][participantHint], "Not a participant");
        
        isParticipant[domainId][participantHint] = false;
        domains[domainId].participantCount--;
        
        // Note: We don't remove from array to save gas, just mark as inactive
        emit ParticipantRemoved(domainId, participantHint);
    }
    
    /**
     * @notice Deactivate a domain
     * @param domainId The domain to deactivate
     */
    function deactivateDomain(bytes32 domainId) external onlyDomainAdmin(domainId) {
        domains[domainId].active = false;
        emit DomainDeactivated(domainId);
    }
    
    /**
     * @notice Transfer domain admin to a new address
     * @param domainId The domain to transfer
     * @param newAdmin The new administrator address
     */
    function transferAdmin(
        bytes32 domainId,
        address newAdmin
    ) external onlyDomainAdmin(domainId) {
        require(newAdmin != address(0), "Invalid admin address");
        domains[domainId].admin = newAdmin;
        adminDomains[newAdmin].push(domainId);
    }
    
    /**
     * @notice Get domain details
     * @param domainId The domain to query
     */
    function getDomain(bytes32 domainId) external view returns (
        address admin,
        string memory name,
        bool active,
        uint256 createdAt,
        uint256 participantCount
    ) {
        Domain storage d = domains[domainId];
        return (d.admin, d.name, d.active, d.createdAt, d.participantCount);
    }
    
    /**
     * @notice Get all participant hints for a domain
     * @param domainId The domain to query
     */
    function getDomainParticipants(bytes32 domainId) external view returns (bytes32[] memory) {
        return domainParticipants[domainId];
    }
    
    /**
     * @notice Check if a hint is a participant in a domain
     * @param domainId The domain to check
     * @param participantHint The participant hint to check
     */
    function checkParticipant(
        bytes32 domainId,
        bytes32 participantHint
    ) external view returns (bool) {
        return isParticipant[domainId][participantHint];
    }
    
    /**
     * @notice Get all domains managed by an admin
     * @param admin The admin address to query
     */
    function getAdminDomains(address admin) external view returns (bytes32[] memory) {
        return adminDomains[admin];
    }
}

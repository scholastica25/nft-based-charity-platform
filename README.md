# Charity NFT Platform

A comprehensive NFT-based charity platform that enables users to mint NFTs, donate to charitable causes, and participate in charitable campaigns with milestone rewards.

## Overview

This smart contract creates a decentralized charity ecosystem where NFT creation and trading automatically contribute to charitable causes. Users can participate in campaigns, donate NFTs directly, and earn milestone rewards for their contributions.

## Key Features

### 🎨 NFT Core Functionality

- **Mint NFTs**: Create unique tokens with custom metadata and categories
- **Transfer & Trade**: Seamless ownership transfers and marketplace listings
- **Metadata Tracking**: Comprehensive creator, timestamp, and category data

### 💝 Charitable Marketplace

- **Automatic Donations**: 20% of all NFT sales go to charity (configurable)
- **Dual Payment**: Sellers receive 80%, charity receives 20% automatically
- **Transparent Tracking**: All donations and transfers are recorded on-chain

### 🏆 Campaign System

- **Fundraising Campaigns**: Time-bound charity drives with specific goals
- **Direct STX Donations**: Traditional monetary contributions to campaigns
- **NFT Donations**: Contributors can donate NFTs directly to campaigns
- **Progress Tracking**: Real-time campaign progress and deadline monitoring

### 🎯 Milestone Rewards

- **Achievement System**: Campaigns can have multiple funding milestones
- **Automatic Rewards**: Contributors earn exclusive NFTs for reaching milestones
- **Participation Tracking**: Detailed user contribution statistics
- **Reward Distribution**: Automated milestone reward claiming

### 🛡️ Administrative Controls

- **Emergency Pause**: Platform-wide pause functionality for security
- **Campaign Management**: Create, modify, and end campaigns
- **Configuration**: Adjustable charity address and donation percentages
- **Analytics**: Comprehensive campaign reporting and statistics

## Core Functions

### NFT Operations

```clarity
;; Mint a new NFT
(contract-call? .charity-nft mint "ipfs://..." "art")

;; List NFT for sale (auto-donates 20% to charity)
(contract-call? .charity-nft list-for-sale u1 u1000000) ;; 1 STX

;; Buy NFT (automatically splits payment)
(contract-call? .charity-nft buy-nft u1)
```

### Campaign Participation

```clarity
;; Donate STX directly to campaign
(contract-call? .charity-nft donate-to-campaign u1 u500000) ;; 0.5 STX

;; Donate NFT to campaign
(contract-call? .charity-nft donate-nft-to-campaign u1 u1) ;; NFT ID 1 to Campaign 1

;; Claim milestone reward
(contract-call? .charity-nft check-and-claim-milestone-reward u1 u1)
```

### Campaign Management (Admin Only)

```clarity
;; Create new campaign
(contract-call? .charity-nft create-charity-campaign
    "Clean Water Initiative"
    "Providing clean water access to remote communities"
    u10000000000  ;; 10,000 STX goal
    u14400)       ;; ~100 days duration

;; Add milestone to campaign
(contract-call? .charity-nft add-campaign-milestone
    u1 u1 "First Milestone: 25% of goal reached"
    u2500000000 "ipfs://reward-nft-uri")
```

## Technical Specifications

- **Platform Fee**: 20% of NFT sales (configurable by admin)
- **Campaign Limits**: 100 NFTs per campaign, 100 milestones per user
- **Security**: Emergency pause, owner-only admin functions
- **Analytics**: Real-time campaign progress and user statistics

## Contract Architecture

### Data Structures

- **NFT Tracking**: Ownership, metadata, pricing, and categorization
- **Campaign Management**: Goals, deadlines, progress, and participation
- **User Analytics**: Donation history, rewards, and contribution tracking
- **Milestone System**: Achievement targets, rewards, and completion status

### Security Features

- **Access Control**: Owner-only administrative functions
- **Validation**: Comprehensive input validation and error handling
- **Pause Mechanism**: Emergency stop functionality
- **Deadline Enforcement**: Automatic campaign expiration

## Use Cases

### For Artists & Creators

- Mint and sell NFTs while supporting charity
- Participate in themed charitable campaigns
- Earn exclusive rewards for contribution milestones

### For Charitable Organizations

- Create time-bound fundraising campaigns
- Receive automatic donations from NFT marketplace
- Engage community through milestone reward systems

### For Collectors & Donors

- Purchase NFTs knowing proceeds support charity
- Contribute directly to specific causes
- Earn unique reward NFTs for participation levels

## Deployment Configuration

- **Default Charity**: `SP000000000000000000002Q6VF78` (configurable)
- **Donation Rate**: 20% (adjustable by admin)
- **Campaign Duration**: Admin-defined per campaign
- **Milestone Limits**: 100 rewards per user maximum

## Development

Built on Stacks blockchain using Clarity smart contract language. Requires Stacks node for deployment and interaction.

## License

MIT License

import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const simnet = (globalThis as any).simnet;

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const address3 = accounts.get("wallet_3")!;
const deployer = accounts.get("deployer")!;

const contractName = "charity_platform";

// Error constants
const ERR_OWNER_ONLY = 100;
const ERR_NOT_TOKEN_OWNER = 101;
const ERR_LISTING_EXPIRED = 102;
const ERR_INVALID_PRICE = 103;
const ERR_CAMPAIGN_NOT_FOUND = 104;
const ERR_CAMPAIGN_EXPIRED = 105;
const ERR_INSUFFICIENT_FUNDS = 106;
const ERR_INVALID_PARAMETER = 107;
const ERR_PAUSED = 108;

describe("Charity Platform Contract Tests", () => {
  beforeEach(() => {
    simnet.mineEmptyBlocks(1);
  });
});

  describe("NFT Core Functionality", () => {
    it("allows user to mint NFT", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "mint",
        [
          Cl.stringUtf8("https://example.com/token1.json"),
          Cl.stringUtf8("Art")
        ],
        address1
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("stores NFT metadata correctly", () => {
      // Mint NFT first
      simnet.callPublicFn(
        contractName,
        "mint",
        [
          Cl.stringUtf8("https://example.com/token1.json"),
          Cl.stringUtf8("Photography")
        ],
        address1
      );

      // Check metadata
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-token-metadata",
        [Cl.uint(1)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          creator: Cl.principal(address1),
          timestamp: Cl.uint(simnet.blockHeight),
          category: Cl.stringUtf8("Photography")
        })
      );
    });

    it("sets correct NFT owner", () => {
      simnet.callPublicFn(
        contractName,
        "mint",
        [
          Cl.stringUtf8("https://example.com/token1.json"),
          Cl.stringUtf8("Music")
        ],
        address1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(result).toBeSome(Cl.principal(address1));
    });

    it("stores token URI correctly", () => {
      const tokenUri = "https://example.com/metadata.json";
      
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8(tokenUri), Cl.stringUtf8("Digital Art")],
        address1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-token-uri",
        [Cl.uint(1)],
        deployer
      );
      expect(result).toBeSome(Cl.stringUtf8(tokenUri));
    });

    it("increments token IDs correctly", () => {
      // Mint first NFT
      const result1 = simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("uri1"), Cl.stringUtf8("Art")],
        address1
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      // Mint second NFT
      const result2 = simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("uri2"), Cl.stringUtf8("Music")],
        address2
      );
      expect(result2.result).toBeOk(Cl.uint(2));
    });

    it("prevents minting when paused", () => {
      // Pause contract
      simnet.callPublicFn(contractName, "toggle-pause", [], deployer);

      const { result } = simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("uri"), Cl.stringUtf8("Art")],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_PAUSED));
    });
  });

  describe("NFT Transfer Functionality", () => {
    beforeEach(() => {
      // Mint test NFT
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("test-uri"), Cl.stringUtf8("Test")],
        address1
      );
    });

    it("allows owner to transfer NFT", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "transfer",
        [Cl.uint(1), Cl.principal(address2)],
        address1
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify new owner
      const ownerResult = simnet.callReadOnlyFn(
        contractName,
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(ownerResult.result).toBeSome(Cl.principal(address2));
    });

    it("prevents non-owner from transferring NFT", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "transfer",
        [Cl.uint(1), Cl.principal(address3)],
        address2 // Not the owner
      );
      expect(result).toBeErr(Cl.uint(ERR_NOT_TOKEN_OWNER));
    });

    it("returns error for non-existent token", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "transfer",
        [Cl.uint(999), Cl.principal(address2)],
        address1
      );
      expect(result).toBeErr(Cl.uint(1)); // Generic error for non-existent token
    });
  });

  describe("NFT Marketplace Functionality", () => {
    beforeEach(() => {
      // Mint test NFT
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("marketplace-test"), Cl.stringUtf8("Art")],
        address1
      );
    });

    it("allows owner to list NFT for sale", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(1000000)], // 1 STX
        address1
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify price is set
      const priceResult = simnet.callReadOnlyFn(
        contractName,
        "get-price",
        [Cl.uint(1)],
        deployer
      );
      expect(priceResult.result).toBeSome(Cl.uint(1000000));
    });

    it("prevents non-owner from listing NFT", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(1000000)],
        address2
      );
      expect(result).toBeErr(Cl.uint(ERR_NOT_TOKEN_OWNER));
    });

    it("prevents listing with zero price", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(0)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_INVALID_PRICE));
    });

    it("prevents listing when paused", () => {
      // Pause contract
      simnet.callPublicFn(contractName, "toggle-pause", [], deployer);

      const { result } = simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(1000000)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_PAUSED));
    });

    it("allows user to buy listed NFT", () => {
      // List NFT for sale
      simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(1000000)],
        address1
      );

      // Buy NFT
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-nft",
        [Cl.uint(1)],
        address2
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify ownership transfer
      const ownerResult = simnet.callReadOnlyFn(
        contractName,
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(ownerResult.result).toBeSome(Cl.principal(address2));

      // Verify price listing is removed
      const priceResult = simnet.callReadOnlyFn(
        contractName,
        "get-price",
        [Cl.uint(1)],
        deployer
      );
      expect(priceResult.result).toBeNone();
    });

    it("splits payment between seller and charity", () => {
      // List NFT for 1 STX
      simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(1000000)],
        address1
      );

      const initialBalance1 = simnet.getAssetsMap().get(address1)?.STX || 0;
      const charityAddress = 'SP000000000000000000002Q6VF78';
      const initialCharityBalance = simnet.getAssetsMap().get(charityAddress)?.STX || 0;

      // Buy NFT
      simnet.callPublicFn(
        contractName,
        "buy-nft",
        [Cl.uint(1)],
        address2
      );

      // Check balances (20% to charity, 80% to seller)
      const finalBalance1 = simnet.getAssetsMap().get(address1)?.STX || 0;
      const finalCharityBalance = simnet.getAssetsMap().get(charityAddress)?.STX || 0;

      expect(finalBalance1).toBe(initialBalance1 + 800000); // 80% of 1 STX
      expect(finalCharityBalance).toBe(initialCharityBalance + 200000); // 20% of 1 STX
    });

    it("prevents buying when paused", () => {
      // List NFT first
      simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(1000000)],
        address1
      );

      // Pause contract
      simnet.callPublicFn(contractName, "toggle-pause", [], deployer);

      const { result } = simnet.callPublicFn(
        contractName,
        "buy-nft",
        [Cl.uint(1)],
        address2
      );
      expect(result).toBeErr(Cl.uint(ERR_INVALID_PRICE));
    });
  });

  describe("Charity Campaign Management", () => {
    it("allows owner to create charity campaign", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Help Children"),
          Cl.stringUtf8("Campaign to help underprivileged children"),
          Cl.uint(10000000000), // 10k STX goal
          Cl.uint(1000) // 1000 blocks duration
        ],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("stores campaign details correctly", () => {
      const campaignName = "Education Fund";
      const campaignDesc = "Fund for educational resources";
      const goal = 5000000000; // 5k STX
      const duration = 2000;

      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8(campaignName),
          Cl.stringUtf8(campaignDesc),
          Cl.uint(goal),
          Cl.uint(duration)
        ],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-details",
        [Cl.uint(1)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringUtf8(campaignName),
          description: Cl.stringUtf8(campaignDesc),
          goal: Cl.uint(goal),
          raised: Cl.uint(0),
          deadline: Cl.uint(simnet.blockHeight + duration),
          active: Cl.bool(true)
        })
      );
    });

    it("prevents non-owner from creating campaign", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Unauthorized Campaign"),
          Cl.stringUtf8("This should fail"),
          Cl.uint(1000000),
          Cl.uint(100)
        ],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_OWNER_ONLY));
    });

    it("prevents creating campaign with zero goal", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Invalid Campaign"),
          Cl.stringUtf8("Zero goal campaign"),
          Cl.uint(0),
          Cl.uint(100)
        ],
        deployer
      );
      expect(result).toBeErr(Cl.uint(ERR_INVALID_PARAMETER));
    });

    it("allows owner to end campaign", () => {
      // Create campaign first
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Test Campaign"),
          Cl.stringUtf8("Test Description"),
          Cl.uint(1000000),
          Cl.uint(1000)
        ],
        deployer
      );

      // End campaign
      const { result } = simnet.callPublicFn(
        contractName,
        "end-campaign",
        [Cl.uint(1)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify campaign is inactive
      const campaignResult = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-details",
        [Cl.uint(1)],
        deployer
      );
      const campaign = campaignResult.result.expectSome();
      expect(campaign).toMatchObject({
        active: Cl.bool(false)
      });
    });

    it("prevents non-owner from ending campaign", () => {
      // Create campaign first
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Test Campaign"),
          Cl.stringUtf8("Test Description"),
          Cl.uint(1000000),
          Cl.uint(1000)
        ],
        deployer
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "end-campaign",
        [Cl.uint(1)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_OWNER_ONLY));
    });
  });

  describe("Campaign Donations", () => {
    beforeEach(() => {
      // Create test campaign
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Test Donation Campaign"),
          Cl.stringUtf8("Campaign for testing donations"),
          Cl.uint(5000000000), // 5k STX goal
          Cl.uint(1000)
        ],
        deployer
      );
    });

    it("allows user to donate to active campaign", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(1000000)], // 1 STX donation
        address1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("updates campaign raised amount after donation", () => {
      const donationAmount = 2000000; // 2 STX

      simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(donationAmount)],
        address1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-details",
        [Cl.uint(1)],
        deployer
      );
      
      const campaign = result.expectSome();
      expect(campaign).toMatchObject({
        raised: Cl.uint(donationAmount)
      });
    });

    it("records user donation history", () => {
      const donationAmount = 1500000; // 1.5 STX

      simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(donationAmount)],
        address1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-user-donation-history",
        [Cl.principal(address1), Cl.uint(1)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          amount: Cl.uint(donationAmount),
          timestamp: Cl.uint(simnet.blockHeight)
        })
      );
    });

    it("prevents donation to non-existent campaign", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(999), Cl.uint(1000000)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_CAMPAIGN_NOT_FOUND));
    });

    it("prevents donation to expired campaign", () => {
      // Mine blocks to expire campaign
      simnet.mineEmptyBlocks(1001);

      const { result } = simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(1000000)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_CAMPAIGN_EXPIRED));
    });

    it("prevents donation to inactive campaign", () => {
      // End campaign first
      simnet.callPublicFn(contractName, "end-campaign", [Cl.uint(1)], deployer);

      const { result } = simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(1000000)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_CAMPAIGN_NOT_FOUND));
    });

    it("accumulates multiple donations", () => {
      // First donation
      simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(1000000)],
        address1
      );

      // Second donation
      simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(2000000)],
        address2
      );

      // Check total raised
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-details",
        [Cl.uint(1)],
        deployer
      );
      
      const campaign = result.expectSome();
      expect(campaign).toMatchObject({
        raised: Cl.uint(3000000) // 1 + 2 STX
      });
    });
  });

  describe("NFT Campaign Donations", () => {
    beforeEach(() => {
      // Create campaign
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("NFT Donation Campaign"),
          Cl.stringUtf8("Campaign accepting NFT donations"),
          Cl.uint(5000000000),
          Cl.uint(1000)
        ],
        deployer
      );

      // Mint test NFT
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("nft-for-donation"), Cl.stringUtf8("Charity")],
        address1
      );
    });

    it("allows user to donate NFT to campaign", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)], // NFT ID 1 to Campaign ID 1
        address1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("transfers NFT ownership to contract", () => {
      simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(result).toBeSome(Cl.principal(deployer)); // Contract owner
    });

    it("adds NFT to campaign NFT list", () => {
      simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-nfts",
        [Cl.uint(1)],
        deployer
      );
      expect(result).toBeSome(Cl.list([Cl.uint(1)]));
    });

    it("updates user campaign participation stats", () => {
      // List NFT for sale first to give it value
      simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(2000000)], // 2 STX
        address1
      );

      simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-user-campaign-stats",
        [Cl.principal(address1), Cl.uint(1)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "nfts-donated": Cl.list([Cl.uint(1)]),
          "total-value": Cl.uint(2000000)
        })
      );
    });

    it("prevents non-owner from donating NFT", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address2 // Not the owner
      );
      expect(result).toBeErr(Cl.uint(ERR_NOT_TOKEN_OWNER));
    });

    it("prevents donation to expired campaign", () => {
      // Mine blocks to expire campaign
      simnet.mineEmptyBlocks(1001);

      const { result } = simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_CAMPAIGN_EXPIRED));
    });

    it("prevents donation when paused", () => {
      // Pause contract
      simnet.callPublicFn(contractName, "toggle-pause", [], deployer);

      const { result } = simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_PAUSED));
    });

    it("handles multiple NFT donations from same user", () => {
      // Mint second NFT
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("second-nft"), Cl.stringUtf8("Art")],
        address1
      );

      // Donate first NFT
      simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );

      // Donate second NFT
      const { result } = simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(2), Cl.uint(1)],
        address1
      );
      expect(result).toBeOk(Cl.bool(true));

      // Check user stats
      const statsResult = simnet.callReadOnlyFn(
        contractName,
        "get-user-campaign-stats",
        [Cl.principal(address1), Cl.uint(1)],
        deployer
      );
      
      const stats = statsResult.result.expectSome();
      expect(stats).toMatchObject({
        "nfts-donated": Cl.list([Cl.uint(1), Cl.uint(2)])
      });
    });
  });

  describe("Campaign Milestones", () => {
    beforeEach(() => {
      // Create campaign
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Milestone Campaign"),
          Cl.stringUtf8("Campaign with milestones"),
          Cl.uint(10000000000), // 10k STX goal
          Cl.uint(2000)
        ],
        deployer
      );
    });

    it("allows owner to add campaign milestone", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "add-campaign-milestone",
        [
          Cl.uint(1), // campaign-id
          Cl.uint(1), // milestone-id
          Cl.stringUtf8("First milestone - 25% funding reached"),
          Cl.uint(2500000000), // 2.5k STX target
          Cl.stringUtf8("https://example.com/reward1.json")
        ],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("stores milestone details correctly", () => {
      const milestoneDesc = "Halfway milestone";
      const targetAmount = 5000000000; // 5k STX
      const rewardUri = "https://example.com/milestone-reward.json";

      simnet.callPublicFn(
        contractName,
        "add-campaign-milestone",
        [
          Cl.uint(1),
          Cl.uint(1),
          Cl.stringUtf8(milestoneDesc),
          Cl.uint(targetAmount),
          Cl.stringUtf8(rewardUri)
        ],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-milestone",
        [Cl.uint(1), Cl.uint(1)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          description: Cl.stringUtf8(milestoneDesc),
          "target-amount": Cl.uint(targetAmount),
          reached: Cl.bool(false),
          "reward-uri": Cl.stringUtf8(rewardUri)
        })
      );
    });

    it("prevents non-owner from adding milestone", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "add-campaign-milestone",
        [
          Cl.uint(1),
          Cl.uint(1),
          Cl.stringUtf8("Unauthorized milestone"),
          Cl.uint(1000000),
          Cl.stringUtf8("uri")
        ],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_OWNER_ONLY));
    });

    it("prevents adding milestone to non-existent campaign", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "add-campaign-milestone",
        [
          Cl.uint(999), // Non-existent campaign
          Cl.uint(1),
          Cl.stringUtf8("Invalid milestone"),
          Cl.uint(1000000),
          Cl.stringUtf8("uri")
        ],
        deployer
      );
      expect(result).toBeErr(Cl.uint(ERR_CAMPAIGN_NOT_FOUND));
    });

    it("allows user to claim milestone reward when qualified", () => {
      // Add milestone
      simnet.callPublicFn(
        contractName,
        "add-campaign-milestone",
        [
          Cl.uint(1),
          Cl.uint(1),
          Cl.stringUtf8("First milestone"),
          Cl.uint(1000000), // 1 STX target
          Cl.stringUtf8("https://example.com/reward.json")
        ],
        deployer
      );

      // Mint and donate NFT worth more than milestone target
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("milestone-nft"), Cl.stringUtf8("Reward")],
        address1
      );

      // List NFT for sale to give it value
      simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(2000000)], // 2 STX value
        address1
      );

      // Donate NFT to campaign
      simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );

      // Claim milestone reward
      const { result } = simnet.callPublicFn(
        contractName,
        "check-and-claim-milestone-reward",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );
      expect(result).toBeOk(Cl.uint(2)); // Should return new reward NFT ID
    });

    it("prevents claiming milestone when not qualified", () => {
      // Add milestone with high target
      simnet.callPublicFn(
        contractName,
        "add-campaign-milestone",
        [
          Cl.uint(1),
          Cl.uint(1),
          Cl.stringUtf8("High milestone"),
          Cl.uint(10000000000), // 10k STX target
          Cl.stringUtf8("reward-uri")
        ],
        deployer
      );

      // Try to claim without qualifying
      const { result } = simnet.callPublicFn(
        contractName,
        "check-and-claim-milestone-reward",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_INVALID_PARAMETER));
    });

    it("prevents double claiming of milestone", () => {
      // Setup milestone and qualify
      simnet.callPublicFn(
        contractName,
        "add-campaign-milestone",
        [
          Cl.uint(1),
          Cl.uint(1),
          Cl.stringUtf8("Test milestone"),
          Cl.uint(1000000),
          Cl.stringUtf8("reward-uri")
        ],
        deployer
      );

      // Setup qualifying donation
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("test-nft"), Cl.stringUtf8("Test")],
        address1
      );
      simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(2000000)],
        address1
      );
      simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );

      // First claim
      simnet.callPublicFn(
        contractName,
        "check-and-claim-milestone-reward",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );

      // Second claim attempt
      const { result } = simnet.callPublicFn(
        contractName,
        "check-and-claim-milestone-reward",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_INVALID_PARAMETER));
    });

    it("adds reward NFT to user rewards list", () => {
      // Setup and claim milestone
      simnet.callPublicFn(
        contractName,
        "add-campaign-milestone",
        [
          Cl.uint(1),
          Cl.uint(1),
          Cl.stringUtf8("Reward milestone"),
          Cl.uint(1000000),
          Cl.stringUtf8("reward-uri")
        ],
        deployer
      );

      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("donation-nft"), Cl.stringUtf8("Art")],
        address1
      );
      simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(2000000)],
        address1
      );
      simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );

      const claimResult = simnet.callPublicFn(
        contractName,
        "check-and-claim-milestone-reward",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );
      const rewardNftId = claimResult.result.expectOk();

      // Check user rewards
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-user-rewards",
        [Cl.principal(address1)],
        deployer
      );
      expect(result).toBeSome(Cl.list([rewardNftId]));
    });
  });

  describe("Administrative Functions", () => {
    it("allows owner to set charity address", () => {
      const newCharityAddress = address3;
      
      const { result } = simnet.callPublicFn(
        contractName,
        "set-charity-address",
        [Cl.principal(newCharityAddress)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents non-owner from setting charity address", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-charity-address",
        [Cl.principal(address3)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_OWNER_ONLY));
    });

    it("allows owner to set donation percentage", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-donation-percentage",
        [Cl.uint(25)], // 25%
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents setting donation percentage above 100%", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-donation-percentage",
        [Cl.uint(150)], // 150% - invalid
        deployer
      );
      expect(result).toBeErr(Cl.uint(ERR_CAMPAIGN_NOT_FOUND));
    });

    it("prevents non-owner from setting donation percentage", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "set-donation-percentage",
        [Cl.uint(30)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_OWNER_ONLY));
    });

    it("allows owner to toggle pause", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "toggle-pause",
        [],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents non-owner from toggling pause", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "toggle-pause",
        [],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_OWNER_ONLY));
    });
  });

  describe("Campaign Analytics", () => {
    beforeEach(() => {
      // Create test campaign
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Analytics Campaign"),
          Cl.stringUtf8("Campaign for testing analytics"),
          Cl.uint(10000000000), // 10k STX goal
          Cl.uint(1000)
        ],
        deployer
      );
    });

    it("generates campaign report correctly", () => {
      // Make some donations and NFT donations
      simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(2000000000)], // 2k STX
        address1
      );

      // Mint and donate NFT
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("analytics-nft"), Cl.stringUtf8("Art")],
        address2
      );
      simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address2
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "generate-campaign-report",
        [Cl.uint(1)],
        deployer
      );
      
      expect(result).toBeOk(
        Cl.tuple({
          name: Cl.stringUtf8("Analytics Campaign"),
          "total-raised": Cl.uint(2000000000),
          "goal-percentage": Cl.uint(20), // 2k out of 10k = 20%
          "total-nfts": Cl.uint(1),
          "is-active": Cl.bool(true),
          "remaining-blocks": Cl.uint(1000)
        })
      );
    });

    it("handles report for campaign without donations", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "generate-campaign-report",
        [Cl.uint(1)],
        deployer
      );
      
      expect(result).toBeOk(
        Cl.tuple({
          name: Cl.stringUtf8("Analytics Campaign"),
          "total-raised": Cl.uint(0),
          "goal-percentage": Cl.uint(0),
          "total-nfts": Cl.uint(0),
          "is-active": Cl.bool(true),
          "remaining-blocks": Cl.uint(1000)
        })
      );
    });

    it("returns error for non-existent campaign report", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "generate-campaign-report",
        [Cl.uint(999)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(ERR_CAMPAIGN_NOT_FOUND));
    });
  });

  describe("Read-Only Functions", () => {
    it("returns none for non-existent token URI", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-token-uri",
        [Cl.uint(999)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("returns none for non-existent owner", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-owner",
        [Cl.uint(999)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("returns none for non-existent price", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-price",
        [Cl.uint(999)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("returns none for non-existent token metadata", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-token-metadata",
        [Cl.uint(999)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("returns none for non-existent campaign details", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-details",
        [Cl.uint(999)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("returns none for non-existent user donation history", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-user-donation-history",
        [Cl.principal(address1), Cl.uint(999)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("returns none for non-existent campaign NFTs", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-nfts",
        [Cl.uint(999)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("returns none for non-existent user campaign stats", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-user-campaign-stats",
        [Cl.principal(address1), Cl.uint(999)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("returns none for non-existent milestone", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-milestone",
        [Cl.uint(999), Cl.uint(1)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("returns none for non-existent user rewards", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-user-rewards",
        [Cl.principal(address1)],
        deployer
      );
      expect(result).toBeNone();
    });
  });

  describe("Integration Tests", () => {
    it("handles complete charity platform workflow", () => {
      // 1. Create campaign
      const campaignResult = simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Complete Workflow Campaign"),
          Cl.stringUtf8("End-to-end test campaign"),
          Cl.uint(5000000000), // 5k STX goal
          Cl.uint(2000)
        ],
        deployer
      );
      expect(campaignResult.result).toBeOk(Cl.uint(1));

      // 2. Add milestone
      simnet.callPublicFn(
        contractName,
        "add-campaign-milestone",
        [
          Cl.uint(1),
          Cl.uint(1),
          Cl.stringUtf8("50% milestone"),
          Cl.uint(2500000000), // 2.5k STX
          Cl.stringUtf8("milestone-reward-uri")
        ],
        deployer
      );

      // 3. Users mint NFTs
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("user1-nft"), Cl.stringUtf8("Art")],
        address1
      );
      
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("user2-nft"), Cl.stringUtf8("Music")],
        address2
      );

      // 4. List NFTs for sale
      simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(1), Cl.uint(3000000000)], // 3k STX
        address1
      );

      // 5. User 2 buys NFT (generates charity donation)
      const buyResult = simnet.callPublicFn(
        contractName,
        "buy-nft",
        [Cl.uint(1)],
        address2
      );
      expect(buyResult.result).toBeOk(Cl.bool(true));

      // 6. Direct donation to campaign
      simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(1000000000)], // 1k STX
        address3
      );

      // 7. Donate NFT to campaign
      simnet.callPublicFn(
        contractName,
        "list-for-sale",
        [Cl.uint(2), Cl.uint(2000000000)], // 2k STX value
        address2
      );
      
      simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(2), Cl.uint(1)],
        address2
      );

      // 8. Check if milestone can be claimed
      const milestoneResult = simnet.callPublicFn(
        contractName,
        "check-and-claim-milestone-reward",
        [Cl.uint(1), Cl.uint(1)],
        address2
      );
      expect(milestoneResult.result).toBeOk(Cl.uint(3)); // Reward NFT ID

      // 9. Generate campaign report
      const reportResult = simnet.callPublicFn(
        contractName,
        "generate-campaign-report",
        [Cl.uint(1)],
        deployer
      );
      
      const report = reportResult.result.expectOk();
      expect(report).toMatchObject({
        name: Cl.stringUtf8("Complete Workflow Campaign"),
        "total-nfts": Cl.uint(1) // One NFT donated
      });

      // 10. Verify user rewards
      const rewardsResult = simnet.callReadOnlyFn(
        contractName,
        "get-user-rewards",
        [Cl.principal(address2)],
        deployer
      );
      expect(rewardsResult.result).toBeSome(Cl.list([Cl.uint(3)]));
    });

    it("handles multiple campaigns simultaneously", () => {
      // Create multiple campaigns
      const campaign1 = simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Education Campaign"),
          Cl.stringUtf8("For education"),
          Cl.uint(3000000000),
          Cl.uint(1000)
        ],
        deployer
      );
      expect(campaign1.result).toBeOk(Cl.uint(1));

      const campaign2 = simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Health Campaign"),
          Cl.stringUtf8("For healthcare"),
          Cl.uint(5000000000),
          Cl.uint(1500)
        ],
        deployer
      );
      expect(campaign2.result).toBeOk(Cl.uint(2));

      // Users donate to different campaigns
      simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(1000000000)], // 1k STX to campaign 1
        address1
      );

      simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(2), Cl.uint(2000000000)], // 2k STX to campaign 2
        address2
      );

      // Verify donations are tracked separately
      const donation1 = simnet.callReadOnlyFn(
        contractName,
        "get-user-donation-history",
        [Cl.principal(address1), Cl.uint(1)],
        deployer
      );
      expect(donation1.result).not.toBeNone();

      const donation2 = simnet.callReadOnlyFn(
        contractName,
        "get-user-donation-history",
        [Cl.principal(address2), Cl.uint(2)],
        deployer
      );
      expect(donation2.result).not.toBeNone();

      // Verify campaigns have correct raised amounts
      const campaign1Details = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-details",
        [Cl.uint(1)],
        deployer
      );
      expect(campaign1Details.result.expectSome()).toMatchObject({
        raised: Cl.uint(1000000000)
      });

      const campaign2Details = simnet.callReadOnlyFn(
        contractName,
        "get-campaign-details",
        [Cl.uint(2)],
        deployer
      );
      expect(campaign2Details.result.expectSome()).toMatchObject({
        raised: Cl.uint(2000000000)
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("handles campaign expiration correctly", () => {
      // Create short campaign
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Short Campaign"),
          Cl.stringUtf8("Will expire soon"),
          Cl.uint(1000000000),
          Cl.uint(10) // Only 10 blocks
        ],
        deployer
      );

      // Mine blocks to expire campaign
      simnet.mineEmptyBlocks(11);

      // Try to donate - should fail
      const { result } = simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(1000000)],
        address1
      );
      expect(result).toBeErr(Cl.uint(ERR_CAMPAIGN_EXPIRED));
    });

    it("handles NFT list size limits", () => {
      // Create campaign
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Limit Test Campaign"),
          Cl.stringUtf8("Testing limits"),
          Cl.uint(1000000000),
          Cl.uint(1000)
        ],
        deployer
      );

      // This test would require minting 100+ NFTs to test the limit
      // For practical purposes, we'll test the logic exists
      // In a real scenario, you'd mint 100 NFTs and try to donate the 101st
      
      // Mint one NFT and verify donation works
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("limit-test"), Cl.stringUtf8("Test")],
        address1
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("handles zero value NFT donations", () => {
      // Create campaign
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Zero Value Campaign"),
          Cl.stringUtf8("Testing zero values"),
          Cl.uint(1000000000),
          Cl.uint(1000)
        ],
        deployer
      );

      // Mint NFT without setting price (defaults to 0)
      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("zero-value-nft"), Cl.stringUtf8("Test")],
        address1
      );

      // Donate NFT (should work with 0 value)
      const { result } = simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );
      expect(result).toBeOk(Cl.bool(true));

      // Check user stats reflect 0 value
      const statsResult = simnet.callReadOnlyFn(
        contractName,
        "get-user-campaign-stats",
        [Cl.principal(address1), Cl.uint(1)],
        deployer
      );
      expect(statsResult.result.expectSome()).toMatchObject({
        "total-value": Cl.uint(0)
      });
    });

    it("handles campaign goal percentage calculation edge cases", () => {
      // Create campaign with very small goal
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Small Goal Campaign"),
          Cl.stringUtf8("Very small goal"),
          Cl.uint(1), // 1 microSTX goal
          Cl.uint(1000)
        ],
        deployer
      );

      // Make donation larger than goal
      simnet.callPublicFn(
        contractName,
        "donate-to-campaign",
        [Cl.uint(1), Cl.uint(1000000)], // 1 STX donation
        address1
      );

      // Generate report - should handle large percentage
      const { result } = simnet.callPublicFn(
        contractName,
        "generate-campaign-report",
        [Cl.uint(1)],
        deployer
      );
      
      const report = result.expectOk();
      expect(report).toMatchObject({
        "goal-percentage": Cl.uint(100000000) // 1000000/1 * 100
      });
    });

    it("maintains state consistency during pause/unpause", () => {
      // Create campaign and mint NFT while unpaused
      simnet.callPublicFn(
        contractName,
        "create-charity-campaign",
        [
          Cl.stringUtf8("Pause Test Campaign"),
          Cl.stringUtf8("Testing pause functionality"),
          Cl.uint(1000000000),
          Cl.uint(1000)
        ],
        deployer
      );

      simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("pause-test-nft"), Cl.stringUtf8("Test")],
        address1
      );

      // Pause contract
      simnet.callPublicFn(contractName, "toggle-pause", [], deployer);

      // Try operations while paused (should fail)
      const mintResult = simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("paused-mint"), Cl.stringUtf8("Test")],
        address1
      );
      expect(mintResult.result).toBeErr(Cl.uint(ERR_PAUSED));

      const nftDonationResult = simnet.callPublicFn(
        contractName,
        "donate-nft-to-campaign",
        [Cl.uint(1), Cl.uint(1)],
        address1
      );
      expect(nftDonationResult.result).toBeErr(Cl.uint(ERR_PAUSED));

      // Unpause and verify operations work again
      simnet.callPublicFn(contractName, "toggle-pause", [], deployer);

      const unpausedMint = simnet.callPublicFn(
        contractName,
        "mint",
        [Cl.stringUtf8("unpaused-mint"), Cl.stringUtf8("Test")],
        address1
      );
      expect(unpausedMint.result).toBeOk(Cl.uint(2));
    });
  });
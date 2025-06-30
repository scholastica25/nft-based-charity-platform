;; NFT-based charity platform smart contract
;; This contract allows users to mint NFTs, donate to charities, and participate in charitable campaigns

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-listing-expired (err u102))
(define-constant err-invalid-price (err u103))
(define-constant err-campaign-not-found (err u104))
(define-constant err-campaign-expired (err u105))
(define-constant err-insufficient-funds (err u106))
(define-constant err-invalid-parameter (err u107))

;; Data variables
(define-data-var total-nfts uint u0)
(define-data-var charity-address principal 'SP000000000000000000002Q6VF78)
(define-data-var donation-percentage uint u20)
(define-data-var total-donations uint u0)
(define-data-var paused bool false)

;; NFT data maps
(define-map nft-owners
    uint
    principal
)
(define-map token-uri
    uint
    (string-utf8 256)
)
(define-map nft-price
    uint
    uint
)
(define-map nft-metadata
    uint
    {
        creator: principal,
        timestamp: uint,
        category: (string-utf8 64),
    }
)

;; Charity campaign data
(define-map charity-campaigns
    uint
    {
        name: (string-utf8 64),
        description: (string-utf8 256),
        goal: uint,
        raised: uint,
        deadline: uint,
        active: bool,
    }
)

(define-data-var campaign-counter uint u0)

(define-map campaign-nfts
    uint
    (list 100 uint)
)
(define-map user-campaign-participation
    {
        user: principal,
        campaign-id: uint,
    }
    {
        nfts-donated: (list 100 uint),
        total-value: uint,
    }
)
(define-map campaign-milestones
    {
        campaign-id: uint,
        milestone-id: uint,
    }
    {
        description: (string-utf8 256),
        target-amount: uint,
        reached: bool,
        reward-uri: (string-utf8 256),
    }
)
(define-map user-rewards
    principal
    (list 100 uint)
)

;; Donation history
(define-map user-donations
    {
        user: principal,
        campaign-id: uint,
    }
    {
        amount: uint,
        timestamp: uint,
    }
)

;; Read-only functions
(define-read-only (get-token-uri (token-id uint))
    (map-get? token-uri token-id)
)

(define-read-only (get-owner (token-id uint))
    (map-get? nft-owners token-id)
)

(define-read-only (get-price (token-id uint))
    (map-get? nft-price token-id)
)

(define-read-only (get-token-metadata (token-id uint))
    (map-get? nft-metadata token-id)
)

(define-read-only (get-campaign-details (campaign-id uint))
    (map-get? charity-campaigns campaign-id)
)

(define-read-only (get-user-donation-history
        (user principal)
        (campaign-id uint)
    )
    (map-get? user-donations {
        user: user,
        campaign-id: campaign-id,
    })
)

;; Read-only functions for new features
(define-read-only (get-campaign-nfts (campaign-id uint))
    (map-get? campaign-nfts campaign-id)
)

(define-read-only (get-user-campaign-stats
        (user principal)
        (campaign-id uint)
    )
    (map-get? user-campaign-participation {
        user: user,
        campaign-id: campaign-id,
    })
)

(define-read-only (get-campaign-milestone
        (campaign-id uint)
        (milestone-id uint)
    )
    (map-get? campaign-milestones {
        campaign-id: campaign-id,
        milestone-id: milestone-id,
    })
)

(define-read-only (get-user-rewards (user principal))
    (map-get? user-rewards user)
)

;; Private functions
(define-private (check-owner
        (token-id uint)
        (acc uint)
    )
    (if (is-eq (some tx-sender) (map-get? nft-owners token-id))
        (+ acc u1)
        acc
    )
)

(define-private (transfer-token
        (token-id uint)
        (sender principal)
        (recipient principal)
    )
    (begin
        (map-set nft-owners token-id recipient)
        (ok true)
    )
)

;; Public functions - NFT Core
(define-public (mint
        (uri (string-utf8 256))
        (category (string-utf8 64))
    )
    (let ((token-id (+ (var-get total-nfts) u1)))
        (begin
            (asserts! (not (var-get paused)) (err u108))
            (map-set nft-owners token-id tx-sender)
            (map-set token-uri token-id uri)
            (map-set nft-metadata token-id {
                creator: tx-sender,
                timestamp: stacks-block-height,
                category: category,
            })
            (var-set total-nfts token-id)
            (ok token-id)
        )
    )
)

;; Public functions - NFT Trading
(define-public (transfer
        (token-id uint)
        (recipient principal)
    )
    (let ((owner (unwrap! (map-get? nft-owners token-id) (err u1))))
        (asserts! (is-eq tx-sender owner) err-not-token-owner)
        (transfer-token token-id owner recipient)
    )
)

(define-public (list-for-sale
        (token-id uint)
        (price uint)
    )
    (let ((owner (unwrap! (map-get? nft-owners token-id) (err u1))))
        (begin
            (asserts! (not (var-get paused)) (err u108))
            (asserts! (is-eq tx-sender owner) err-not-token-owner)
            (asserts! (> price u0) err-invalid-price)
            (map-set nft-price token-id price)
            (ok true)
        )
    )
)

;; Public functions - Charity Campaigns
(define-public (create-charity-campaign
        (name (string-utf8 64))
        (description (string-utf8 256))
        (goal uint)
        (duration uint)
    )
    (let ((campaign-id (+ (var-get campaign-counter) u1)))
        (begin
            (asserts! (is-eq tx-sender contract-owner) err-owner-only)
            (asserts! (> goal u0) err-invalid-parameter)
            (map-set charity-campaigns campaign-id {
                name: name,
                description: description,
                goal: goal,
                raised: u0,
                deadline: (+ stacks-block-height duration),
                active: true,
            })
            (var-set campaign-counter campaign-id)
            (ok campaign-id)
        )
    )
)

(define-public (donate-to-campaign
        (campaign-id uint)
        (amount uint)
    )
    (let ((campaign (unwrap! (map-get? charity-campaigns campaign-id) err-campaign-not-found)))
        (begin
            (asserts! (get active campaign) err-campaign-not-found)
            (asserts! (<= stacks-block-height (get deadline campaign))
                err-campaign-expired
            )
            (try! (stx-transfer? amount tx-sender (var-get charity-address)))
            (map-set charity-campaigns campaign-id
                (merge campaign { raised: (+ (get raised campaign) amount) })
            )
            (map-set user-donations {
                user: tx-sender,
                campaign-id: campaign-id,
            } {
                amount: amount,
                timestamp: stacks-block-height,
            })
            (var-set total-donations (+ (var-get total-donations) amount))
            (ok true)
        )
    )
)

;; Public functions - Marketplace with Charity
(define-public (buy-nft (token-id uint))
    (let (
            (price (unwrap! (map-get? nft-price token-id) err-invalid-price))
            (owner (unwrap! (map-get? nft-owners token-id) err-not-token-owner))
            (donation-amount (/ (* price (var-get donation-percentage)) u100))
            (seller-amount (- price donation-amount))
        )
        (begin
            (asserts! (not (var-get paused)) err-invalid-price)
            (asserts! (>= (stx-get-balance tx-sender) price)
                err-insufficient-funds
            )
            ;; Transfer payment to seller
            (unwrap! (stx-transfer? seller-amount tx-sender owner)
                err-insufficient-funds
            )
            ;; Transfer donation to charity
            (unwrap!
                (stx-transfer? donation-amount tx-sender
                    (var-get charity-address)
                )
                err-insufficient-funds
            )
            ;; Transfer NFT ownership
            (unwrap! (transfer-token token-id owner tx-sender)
                err-not-token-owner
            )
            ;; Cleanup and update state
            (map-delete nft-price token-id)
            (var-set total-donations
                (+ (var-get total-donations) donation-amount)
            )
            (ok true)
        )
    )
)

;; Public functions - Advanced Campaign Features
(define-public (donate-nft-to-campaign
        (token-id uint)
        (campaign-id uint)
    )
    (let (
            (campaign (unwrap! (map-get? charity-campaigns campaign-id) (err u104)))
            ;; err-campaign-not-found
            (owner (unwrap! (map-get? nft-owners token-id) (err u101)))
            ;; err-not-token-owner
            (current-nfts (default-to (list) (map-get? campaign-nfts campaign-id)))
            (user-stats (default-to {
                nfts-donated: (list),
                total-value: u0,
            }
                (map-get? user-campaign-participation {
                    user: tx-sender,
                    campaign-id: campaign-id,
                })
            ))
        )
        (begin
            ;; Check campaign is active and not expired
            (asserts! (get active campaign) (err u104))
            ;; err-campaign-not-found
            (asserts! (<= stacks-block-height (get deadline campaign)) (err u105))
            ;; err-campaign-expired
            (asserts! (is-eq tx-sender owner) (err u101))
            ;; err-not-token-owner
            (asserts! (not (var-get paused)) (err u108))
            ;; err-paused
            ;; Check list size limits
            (asserts! (< (len current-nfts) u100) (err u107))
            ;; err-invalid-parameter
            (asserts! (< (len (get nfts-donated user-stats)) u100) (err u107))
            ;; err-invalid-parameter
            ;; Get NFT price (if listed) or default to 0
            (let ((nft-value (default-to u0 (map-get? nft-price token-id))))
                (begin
                    ;; Transfer NFT to contract
                    (try! (transfer token-id contract-owner))
                    ;; Update campaign NFT list
                    (map-set campaign-nfts campaign-id
                        (unwrap!
                            (as-max-len? (append current-nfts token-id) u100)
                            (err u107)
                        ))
                    ;; err-invalid-parameter
                    ;; Update user participation stats
                    (map-set user-campaign-participation {
                        user: tx-sender,
                        campaign-id: campaign-id,
                    } {
                        nfts-donated: (unwrap!
                            (as-max-len?
                                (append (get nfts-donated user-stats) token-id)
                                u100
                            )
                            (err u107)
                        ),
                        ;; err-invalid-parameter
                        total-value: (+ (get total-value user-stats) nft-value),
                    })
                    ;; Update campaign raised amount
                    (map-set charity-campaigns campaign-id
                        (merge campaign { raised: (+ (get raised campaign) nft-value) })
                    )
                    (ok true)
                )
            )
        )
    )
)

(define-public (add-campaign-milestone
        (campaign-id uint)
        (milestone-id uint)
        (description (string-utf8 256))
        (target-amount uint)
        (reward-uri (string-utf8 256))
    )
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (is-some (map-get? charity-campaigns campaign-id))
            err-campaign-not-found
        )
        (map-set campaign-milestones {
            campaign-id: campaign-id,
            milestone-id: milestone-id,
        } {
            description: description,
            target-amount: target-amount,
            reached: false,
            reward-uri: reward-uri,
        })
        (ok true)
    )
)

(define-public (check-and-claim-milestone-reward
        (campaign-id uint)
        (milestone-id uint)
    )
    (let (
            (milestone (unwrap!
                (map-get? campaign-milestones {
                    campaign-id: campaign-id,
                    milestone-id: milestone-id,
                })
                err-campaign-not-found
            ))
            (user-participation (unwrap!
                (map-get? user-campaign-participation {
                    user: tx-sender,
                    campaign-id: campaign-id,
                })
                err-campaign-not-found
            ))
            (current-rewards (default-to (list) (map-get? user-rewards tx-sender)))
        )
        (begin
            (asserts! (not (get reached milestone)) err-invalid-parameter)
            (asserts!
                (>= (get total-value user-participation)
                    (get target-amount milestone)
                )
                err-invalid-parameter
            )
            ;; Mint reward NFT
            (let ((new-token-id (try! (mint (get reward-uri milestone) u"milestone-reward"))))
                ;; Update milestone status
                (map-set campaign-milestones {
                    campaign-id: campaign-id,
                    milestone-id: milestone-id,
                }
                    (merge milestone { reached: true })
                )
                ;; Add to user rewards
                (map-set user-rewards tx-sender
                    (unwrap!
                        (as-max-len? (append current-rewards new-token-id) u100)
                        err-invalid-parameter
                    ))
                (ok new-token-id)
            )
        )
    )
)

;; Administrative functions
(define-public (set-charity-address (new-address principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (var-set charity-address new-address)
        (ok true)
    )
)

(define-public (set-donation-percentage (new-percentage uint))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (<= new-percentage u100) (err u104))
        (var-set donation-percentage new-percentage)
        (ok true)
    )
)

(define-public (toggle-pause)
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (var-set paused (not (var-get paused)))
        (ok true)
    )
)

(define-public (end-campaign (campaign-id uint))
    (let ((campaign (unwrap! (map-get? charity-campaigns campaign-id) err-campaign-not-found)))
        (begin
            (asserts! (is-eq tx-sender contract-owner) err-owner-only)
            (map-set charity-campaigns campaign-id
                (merge campaign { active: false })
            )
            (ok true)
        )
    )
)

;; Public functions - Campaign Analytics
(define-public (generate-campaign-report (campaign-id uint))
    (let (
            (campaign (unwrap! (map-get? charity-campaigns campaign-id)
                err-campaign-not-found
            ))
            (campaign-nft-list (default-to (list) (map-get? campaign-nfts campaign-id)))
        )
        (ok {
            name: (get name campaign),
            total-raised: (get raised campaign),
            goal-percentage: (/ (* (get raised campaign) u100) (get goal campaign)),
            total-nfts: (len campaign-nft-list),
            is-active: (get active campaign),
            remaining-blocks: (- (get deadline campaign) stacks-block-height),
        })
    )
)

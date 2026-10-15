# Digivated promotion and Gumroad

The public `/promote` page follows the instructions published at https://digivated.gumroad.com/l/digivated-promo: purchase, submit project details, then await review. Ordinary directory submissions remain free; paid promotion is a separate submission option. Prices and purchase terms stay on Gumroad.

## Owner workflow

1. Open the pending request in the existing authenticated admin page.
2. Match the private checkout email and receipt order reference against the Digivated promo purchase in Gumroad. If the reference is unavailable, the form permits “Match by checkout email.” Resolve ambiguous matches before proceeding.
3. Confirm the correct product, a valid payment, no refund or dispute, and that the order has not already been used for another promotion.
4. Check the purchase-verification box, review the project and image, and explicitly approve/publish or feature it. Verification alone does not publish anything.
5. Prepare any promised social promotion separately. This feature does not send social posts. If a purchase is later refunded or disputed, review and unpublish the corresponding placement manually.

Receipt details are private. Public projections expose only a Sponsored label for verified paid projects; unverified promotion requests cannot appear in project listings, launch pages, image responses, or view tracking. The admin list omits receipt references; authenticated detail access is required. No automated Gumroad transaction verification or refund webhook is introduced.

## Data and rollout

No database migration or backfill is required. New submissions optionally store `promotion: { requested, receiptReference, verified, verifiedAt? }` in the existing Redis records. Missing promotion data keeps existing free submissions working. Validation ignores any client-supplied verification status.

Deploy through the existing GitHub/Vercel pipeline after CI passes. No production test submissions are necessary. Confirm `/promote`, its Gumroad offer link, and `/submit-project?promotion=1`; check unauthenticated admin access remains denied. The legacy host root now redirects to the free library, repairing the old “3 Free Prompts” link on the packet's Gumroad description. Other legacy paths keep their existing canonical redirects. Ideally update that seller description link directly to `https://digivated.com/library?show=available` as well.

Malformed packet license input now returns 401 rather than an incorrect temporary-service 503. Existing license, product, refund, and access checks remain in place.

Rollback requires care after accepting paid submissions: reverting the server publication gates could expose an otherwise approved unverified promotion. Prefer reverting presentation only, retaining the gates, or explicitly archiving affected requests before reverting the full change.

## Validation

76 server tests pass, including paid submission validation, manual verification gates, public-field privacy, and malformed-license handling. Browser coverage checks mobile/desktop promotion instructions, submission selection and payload, and the authenticated approval gate using isolated Redis test data. Existing submission/moderation, collections, launch pages, and view tests remain in the suite.

Both Gumroad products were publicly reachable and published during the audit. Packet product ID matches the configured verifier; recovery and library links resolve. No new purchase, charge, real receipt, or real buyer license was used, so paid checkout completion and seller-side matching remain an owner verification step.

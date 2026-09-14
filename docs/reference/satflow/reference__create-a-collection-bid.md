<!--
Satflow docs — Create a collection bid
Source: https://docs.satflow.com/reference/create-a-collection-bid.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-03-19T15:12:18.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Create a collection bid

Let's wall through the steps involved for creating a collection bid via the API on Satflow.

There are several steps involved in creating a collection bid:

1. Generate a bidding address for your payment and ordinals address using `/address/bidding-wallet`
   1. This bidding address is unique to the payment and ordinals address.
2. Fund the bidding address by simply sending Bitcoin to the generated address from Step 1.
3. Create a collection bid by publishing the bid parameters with `/bid`
   1. You may create a collection bid up to your maximum bidding balance available. You can place your maximum bidding balance as a bid on multiple collections, however if any of these bids are accepted, your remaining bid that fall under your balance will automatically be cancelled.
4. You can then check your existing bids with `/address/bids`
   1. This will return a list of bids for the requested address. Collection bids will be identified with `type = 'collection'`.

### Sign a collection bid message

The collection bid has a special challenge that is required to be signed by the bidder wallet.

The following unsigned message is signed by the bidder's **payment address** (fields below are identical to the post members for `/bid`):

`<bidder_payment_address>:<bidder_payment_address_pubkey>:<bidder_token_receive_address>:<bid_price>:<bid_quantity>:<bid_expiry>:<collection_slug>:<current_timestamp>`

The signed challenge signature for the bid verification represented as a base64 encoded string.

### Cancelling a collection bid

Similar to cancelling a normal listing or bid you can use the `/cancel` endpoint, however the `bid_id` (obtained from `/address/bids`) must be provided instead of the inscription id or outpoint.
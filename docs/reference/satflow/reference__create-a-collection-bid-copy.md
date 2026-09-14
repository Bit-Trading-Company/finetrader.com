<!--
Satflow docs — Accepting a bid
Source: https://docs.satflow.com/reference/create-a-collection-bid-copy.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2025-08-05T19:56:56.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Accepting a bid

Let's wall through the steps involved for accepting a bid on your item via the API on Satflow.

This is for an individual item bid only (not a collection bid).

There are several steps involved in accepting a bid:

1. Find a bid on your item with `/item`
2. Generate the bid acceptance PSBT for signing `/intent/accept`
3. Sign and submit the bid acceptance PSBT to `/bid/fill` for validation and broadcasting.

## Generate a bid acceptance PSBT

You need a few things to generate a bid acceptance PSBT

* `inscription_id` The inscription id to accept a bid of
* `seller_public_key` The public key of current address location of the ordinal, usually 66 characters long, and is hexadecimal format

Now you need to **`POST /intent/accept`** with these included in the body.

You will receive `psbtBast64` for signing.

## Signing PSBTs using local wallet software

Sign all inputs of the PSBT using a wallet of your choice.

## Submitting the signed PSBT to /bid/fill

Now that you have a signed PSBT, you will need to reuse the original parameters which generated the listing (required fields in section 1 of this guide).

In addition to those parameters you need:

* `price` The price of the bid you want to sell your item for in Satoshis
* `seller_ord_address` Your seller ordinal address for where the inscription is currently located
* `seller_receive_address` Your seller payment receiving address
* `signed_accepted_bid_psbt` The signed bid acceptance PSBT formatted as base64 or hex
* `unsigned_accept_bid_psbt` This is the unsigned bid acceptance PSBT from above

**`POST /bid/fill`** with these parameters to sell your item for the bid!
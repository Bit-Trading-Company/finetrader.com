<!--
Satflow docs — Create a listing
Source: https://docs.satflow.com/reference/create-a-listing.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2025-07-16T04:51:53.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Create a listing

Let's walk through the steps required to list via API on Satflow.

Listing on Satflow programatically involves a few things:

1. Generating Listing PSBTs using `/intent/sell`
2. Signing all Listing PSBTs using local wallet software
3. Submitting all Signed PSBTs to `/list`

**Generating Listing PSBTs**

You need a few things to generate a listing PSBT

* `collection_slug` is entirely optional, no need to provide this.
* Required fields:
  * `inscription_id` or `runes_output` - one of these is required to indicate which item is being listed
  * `ord_address` This is the owner address of the specified item
  * `receive_address` This is the address for receiving payment from the sale
  * `price` - The listing price, in satoshis
  * `tap_key` - The public key of `ord_address`, usually 66 characters long, and is hexadecimal format

Now you need to **`POST /intent/sell`** with these included in the body.

You will receive `unsignedListingPSBTBase64` and `secureListingPSBTs`. Since you're listing one item, you will receive a total of 2 PSBTs to sign.

**Signing all Listing PSBTs using local wallet software**

One of these is for the insecure (snipable) with sighash **`SINGLE | ANYONECANPAY`**. The other is for secure listing (where sniping is not possible) and this is sighash **`ALL | ANYONECANPAY`**.

You will need to sign these two PSBTs using a wallet of your choice. The insecure listing PSBT has only one input - you can just sign that. The secure listing PSBT provides a `indicesToSign` field.

Make sure you are signing with the correct sighash at the correct indices.

**Submitting all Signed PSBTs to`/list`**

Now that you have signed both PSBTs, you will need to reuse the original parameters which generated the listing (required fields in section 1 of this guide).

In addition to those parameters you need

* `signed_listing_psbt` in base64 or hex
* `signed_secure_listing_psbt` in base64 or hex
* `unsigned_listing_psbt` is optional!

**`POST /sell`** with these parameters and you've successfully listed!

***

## **Notes**

To edit a listing you are not required to cancel a listing first, just repeat the above steps to replace your listing.
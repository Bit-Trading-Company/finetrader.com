<!--
Satflow docs — Signing the Satflow Challenge
Source: https://docs.satflow.com/reference/request-and-sign-the-satflow-challenge.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2025-08-05T19:57:29.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Signing the Satflow Challenge

Some endpoints require a challenge to be signed to be used. Here a simple step by step guide on how to sign our challenge.

# Challenge Signing Guide

Follow these steps to authenticate using the **Satflow** Challenge Signing API.

***

## **Steps**

### 1. Retrieve the Challenge

Request a challenge linked to your address by sending a `GET` request to `/challenge`.

### 2. Sign the Challenge

Use your private key to sign the `challenge` message retrieved in the previous step using BIP322 generic message signing.

### 3. Verify the Signature

Submit the signed challenge for verification by sending a `GET` request to `/challenge/verify` with your address and signature.

#### Post to Endpoint

Alternatively you can post this signature to an endpoint that requires it (ie `/cancel`).

### 4. Check the Response

If the response confirms `"validity": true`, your signature is successfully verified.

***

## **Notes**

* Keep your private key secure at all times.
* Ensure the signing algorithm matches the API's requirements.
* Refer to the API response documentation for details on request/response formats.
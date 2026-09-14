<!--
Satflow docs — Overview
Source: https://docs.satflow.com/reference/overview.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-03-27T17:22:02.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Overview

# Satflow Marketplace API

The Satflow Marketplace API allows anyone with a valid key to interact with Satflow to manage item listings and explore activity on the platform.

The API supports the following:

* **Listing Items for Sale**: Create and manage listings for selling items on Satflow.
* **Listing Data**: Retrieve current listing information.
* **Bid Data**: Retrieve current bid information.
* **Sales Data**: Retrieve historical sales information.

**A great open source example on how to use the Satflow endpoints can be found in our open source market maker repo,[Satflow Market Maker](https://github.com/SwapLabsInc/satflow-mm)**

## Authentication:

### Obtaining an API Key

This API requires an API key for authentication.  You can request an API [on Google forms](https://docs.google.com/forms/d/e/1FAIpQLSdFHRLrgE-03oVV4ioRbXpHmQs6AnGk1apO9hVUD9hKHGc6Qg/viewform?usp=sharing\&ouid=115516762254973975465).

Once you obtain your API key you will be required to add the `x-api-key` header with your unique API key to your request.

```Text bash
curl -X 'GET' \
  'https://api.satflow.com/v1' \
  -H 'accept: application/json' \
  -H 'x-api-key: YOUR_API_KEY'
```

## Endpoints

| Network     | URL                                                      | Documentation              |
| :---------- | :------------------------------------------------------- | :------------------------- |
| BTC Mainnet | [https://api.satflow.com/v1](https://native.satflow.com) | <https://docs.satflow.com> |

## Rate Limits

| API Tier | Rate Limit                |
| :------- | :------------------------ |
| Partner  | *Depends on requirements* |

## Issues & Feature Requests

For issue reports and feature requests, please contact support on [Discord](https://discord.gg/satflow).
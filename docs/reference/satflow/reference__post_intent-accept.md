<!--
Satflow docs — Create accept bid intent (unsigned PSBT)
Source: https://docs.satflow.com/reference/post_intent-accept.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Create accept bid intent (unsigned PSBT)

Creates an unsigned PSBT for accepting an inscription bid that needs to be signed by the seller

# OpenAPI definition

```json
{
  "openapi": "3.0.3",
  "info": {
    "version": "1.1.4-prod",
    "title": "Satflow Marketplace API",
    "description": "## Satflow Marketplace API\n\nThe Satflow Marketplace API is a RESTful API that allows you to interact with the Satflow Marketplace. The API allows you to:\n\n- **Item and collection Details**: Get information about items and collections on Satflow.\n- **Listing Items for Sale**: Create and manage listings for selling items on Satflow.\n- **Bidding Items for Purchase**: Create and manage bids for buying items on Satflow.\n- **Listing Data**: Retrieve current listing information.\n- **Bid Data**: Retrieve current bid information.\n- **Sales Data**: Retrieve historical sales information.\n\n**A great open source example on how to use the Satflow endpoints can be found in [Satflow Market Maker](https://github.com/SwapLabsInc/satflow-mm)**\n\n### Authentication:\nThis API requires API keys for authentication. You can obtain an API key by contacting support on [Discord](https://discord.gg/satflow).\n",
    "contact": {
      "name": "Satflow Discord",
      "url": "https://discord.gg/satflow"
    }
  },
  "servers": [
    {
      "url": "https://api.satflow.com/v1",
      "description": "Production server"
    }
  ],
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "x-api-key"
      }
    }
  },
  "security": [
    {
      "ApiKeyAuth": []
    }
  ],
  "paths": {
    "/intent/accept": {
      "post": {
        "tags": [
          "Sell listing"
        ],
        "summary": "Create accept bid intent (unsigned PSBT)",
        "description": "Creates an unsigned PSBT for accepting an inscription bid that needs to be signed by the seller",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "inscriptionId"
                ],
                "properties": {
                  "inscriptionId": {
                    "type": "string",
                    "description": "Inscription ID for the bid to accept",
                    "example": "abc123def456..."
                  },
                  "sellerTapInternalKey": {
                    "type": "string",
                    "description": "Seller's taproot internal key. Required whenever Satflow must create an extraction PSBT, including split-address payouts or fee-bump extraction.",
                    "example": "abc123def456..."
                  },
                  "sellerPaymentAddress": {
                    "type": "string",
                    "description": "Optional payment address for split-address payouts. Requires sellerTapInternalKey when it differs from the bid payout address.",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  },
                  "referralAddress": {
                    "type": "string",
                    "description": "Referral address for commission (optional)",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Accept bid intent created successfully"
          },
          "400": {
            "description": "Invalid parameters"
          }
        }
      }
    }
  }
}
```
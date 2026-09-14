<!--
Satflow docs — Create external purchase intent (unsigned PSBT)
Source: https://docs.satflow.com/reference/post_intent-external-purchase.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Create external purchase intent (unsigned PSBT)

Creates an unsigned PSBT for external marketplace purchases. Use `dotswap`; `magiceden` is deprecated and blocked by default.

<br />

<Banner isInline={true} message="External marketplace endpoints depend on external API providers. They are not guaranteed to be reliable and may be deprecated without notice." color="#bb0000" textColor="#ffffff" fontSize="14px" fontWeight="bold" />

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
    "/intent/external-purchase": {
      "post": {
        "tags": [
          "Make a purchase"
        ],
        "summary": "Create external purchase intent (unsigned PSBT)",
        "description": "Creates an unsigned PSBT for external marketplace purchases. Use `dotswap`; `magiceden` is deprecated and blocked by default.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "marketplace",
                  "buyerAddress",
                  "buyerTokenReceiveAddress",
                  "dotswapPayload"
                ],
                "properties": {
                  "marketplace": {
                    "type": "string",
                    "enum": [
                      "dotswap"
                    ],
                    "description": "External marketplace name",
                    "example": "dotswap"
                  },
                  "buyerAddress": {
                    "type": "string",
                    "description": "Buyer's Bitcoin address",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  },
                  "buyerTokenReceiveAddress": {
                    "type": "string",
                    "description": "Address to receive purchased tokens",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  },
                  "dotswapPayload": {
                    "type": "object",
                    "description": "Dotswap-specific payload"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "External purchase intent created successfully"
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
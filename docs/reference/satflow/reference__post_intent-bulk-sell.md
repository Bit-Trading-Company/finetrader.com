<!--
Satflow docs — Create Satflow bulk listing intent (unsigned PSBTs)
Source: https://docs.satflow.com/reference/post_intent-bulk-sell.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Create Satflow bulk listing intent (unsigned PSBTs)

Creates unsigned PSBTs for multiple listings that need to be signed by the user

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
    "/intent/bulk-sell": {
      "post": {
        "tags": [
          "Create listing"
        ],
        "summary": "Create Satflow bulk listing intent (unsigned PSBTs)",
        "description": "Creates unsigned PSBTs for multiple listings that need to be signed by the user",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "listings"
                ],
                "properties": {
                  "listings": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": [
                        "price",
                        "sellerOrdAddress",
                        "sellerReceiveAddress"
                      ],
                      "properties": {
                        "price": {
                          "type": "number",
                          "description": "Listing price in satoshis"
                        },
                        "inscriptionId": {
                          "type": "string",
                          "description": "Inscription ID to list"
                        },
                        "runesOutput": {
                          "type": "string",
                          "description": "Runes output to list"
                        },
                        "sellerOrdAddress": {
                          "type": "string",
                          "description": "Seller's ordinal address"
                        },
                        "sellerReceiveAddress": {
                          "type": "string",
                          "description": "Address to receive payment"
                        },
                        "collectionSlug": {
                          "type": "string",
                          "description": "Collection slug for the listing, including TAP collection ids like \"tap-DMT-NAT\" (optional)"
                        },
                        "sellerPaymentPublicKey": {
                          "type": "string",
                          "description": "Seller's payment public key in hex format"
                        },
                        "sellerPaymentAddress": {
                          "type": "string",
                          "description": "Seller's payment address"
                        },
                        "externalOrderId": {
                          "type": "string",
                          "description": "External order ID (optional)"
                        },
                        "tapInternalKey": {
                          "type": "string",
                          "description": "Taproot internal key (optional)"
                        },
                        "newLocation": {
                          "type": "string",
                          "description": "New location (optional)"
                        },
                        "runesData": {
                          "type": "object",
                          "description": "Runes data (optional)"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Bulk sell intents created successfully"
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
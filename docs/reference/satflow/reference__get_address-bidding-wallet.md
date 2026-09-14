<!--
Satflow docs — Get bidding wallet information
Source: https://docs.satflow.com/reference/get_address-bidding-wallet.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get bidding wallet information

Returns the multiSig wallet information for bidding based on provided addresses and public key

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
    },
    "schemas": {
      "ErrorResponse": {
        "type": "object",
        "required": [
          "error"
        ],
        "properties": {
          "error": {
            "type": "string",
            "example": "For error reasons, review the response data."
          }
        }
      }
    }
  },
  "security": [
    {
      "ApiKeyAuth": []
    }
  ],
  "paths": {
    "/address/bidding-wallet": {
      "get": {
        "tags": [
          "Get bidding"
        ],
        "summary": "Get bidding wallet information",
        "description": "Returns the multiSig wallet information for bidding based on provided addresses and public key",
        "parameters": [
          {
            "in": "query",
            "name": "ordinalsAddress",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "The ordinals address",
            "example": "bc1p..."
          },
          {
            "in": "query",
            "name": "paymentAddress",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "The payment address",
            "example": "bc1q..."
          },
          {
            "in": "query",
            "name": "paymentPubkey",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "The payment public key",
            "example": "02..."
          }
        ],
        "responses": {
          "200": {
            "description": "Bidding wallet information retrieved successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "address": {
                          "type": "string",
                          "nullable": true,
                          "description": "The multiSig wallet address",
                          "example": "bc1p..."
                        },
                        "userPaymentAddress": {
                          "type": "string",
                          "description": "The user's payment address for the bidding wallet",
                          "example": "bc1q..."
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid parameters",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    }
  }
}
```
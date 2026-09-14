<!--
Satflow docs — Submit external purchase transaction (signed PSBT)
Source: https://docs.satflow.com/reference/post_purchase-external.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Submit external purchase transaction (signed PSBT)

Submits a signed external marketplace purchase PSBT to complete the transaction. Use `dotswap`; `magiceden` is deprecated and blocked by default.

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
    "/purchase/external": {
      "post": {
        "tags": [
          "Make a purchase"
        ],
        "summary": "Submit external purchase transaction (signed PSBT)",
        "description": "Submits a signed external marketplace purchase PSBT to complete the transaction. Use `dotswap`; `magiceden` is deprecated and blocked by default.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "buyerAddress",
                  "buyerTokenReceiveAddress",
                  "signedBuyingPSBT",
                  "marketplace",
                  "mpState"
                ],
                "properties": {
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
                  "signedBuyingPSBT": {
                    "type": "string",
                    "description": "Signed buying PSBT in base64 format",
                    "example": "cHNidP8BAH0CAAAAAe..."
                  },
                  "marketplace": {
                    "type": "string",
                    "enum": [
                      "dotswap"
                    ],
                    "description": "External marketplace name",
                    "example": "dotswap"
                  },
                  "mpState": {
                    "type": "object",
                    "description": "Marketplace state object containing transaction details (provided by the intent endpoint)",
                    "additionalProperties": true,
                    "example": {
                      "orderId": "order123",
                      "listingId": "listing456"
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "External purchase transaction submitted successfully",
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
                        "fillTx": {
                          "type": "string",
                          "description": "Transaction ID of the submitted purchase"
                        },
                        "message": {
                          "type": "string",
                          "description": "Success message"
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
<!--
Satflow docs — Verify signed challenge
Source: https://docs.satflow.com/reference/get_challenge-verify.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Verify signed challenge

Verifies that the provided signature is valid for the challenge

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
    "/challenge/verify": {
      "get": {
        "tags": [
          "Satflow Challenge"
        ],
        "summary": "Verify signed challenge",
        "description": "Verifies that the provided signature is valid for the challenge",
        "parameters": [
          {
            "in": "query",
            "name": "address",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Bitcoin wallet address",
            "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
          },
          {
            "in": "query",
            "name": "signature",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Signed challenge message",
            "example": "H1234567890abcdef..."
          }
        ],
        "responses": {
          "200": {
            "description": "Signature verification result",
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
                        "validity": {
                          "type": "boolean",
                          "description": "Whether the signature is valid",
                          "example": true
                        },
                        "publicKey": {
                          "type": "string",
                          "description": "Public key extracted from signature",
                          "example": "02abc123..."
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Missing or invalid parameters",
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
<!--
Satflow docs — Create inscription bid intent (unsigned PSBT)
Source: https://docs.satflow.com/reference/post_intent-bid.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T23:23:37.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Create inscription bid intent (unsigned PSBT)

Creates an unsigned bidding PSBT for placing a bid on a specific inscription. This wraps `createPsbt.bid`; sign the returned PSBT, then submit it with `/bid/place`.

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
    "/intent/bid": {
      "post": {
        "tags": [
          "Get bidding"
        ],
        "summary": "Create inscription bid intent (unsigned PSBT)",
        "description": "Creates an unsigned bidding PSBT for placing a bid on a specific inscription. This wraps `createPsbt.bid`; sign the returned PSBT, then submit it with `/bid/place`.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "price",
                  "inscriptionId",
                  "bidderAddress",
                  "bidderTokenReceiveAddress",
                  "bidderPublicKey"
                ],
                "properties": {
                  "price": {
                    "type": "number",
                    "description": "Bid price in satoshis",
                    "example": 100000
                  },
                  "inscriptionId": {
                    "type": "string",
                    "description": "Inscription ID to bid on",
                    "example": "abc123def456..."
                  },
                  "bidderAddress": {
                    "type": "string",
                    "description": "Bidder's payment address used to fund the bid PSBT",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  },
                  "bidderTokenReceiveAddress": {
                    "type": "string",
                    "description": "Address to receive the inscription if the bid is accepted",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  },
                  "bidderPublicKey": {
                    "type": "string",
                    "description": "Bidder's payment public key in hex format",
                    "example": "02abc123def456..."
                  },
                  "allowedPaymentOutpoints": {
                    "type": "array",
                    "nullable": true,
                    "description": "Optional payment UTXO allowlist. Each entry must be `txid:vout`. Omit or send null to leave unset.",
                    "items": {
                      "type": "string",
                      "pattern": "^[0-9a-fA-F]{64}:[0-9]+$"
                    },
                    "example": [
                      "4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a99887766554433221100ffe:0"
                    ]
                  },
                  "feeRate": {
                    "description": "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB. Custom numeric bid fee rates use a 1 sat/vB minimum.\n",
                    "oneOf": [
                      {
                        "type": "string",
                        "enum": [
                          "fastestFee",
                          "halfHourFee",
                          "hourFee",
                          "minimumFee"
                        ]
                      },
                      {
                        "type": "number",
                        "minimum": 1
                      }
                    ],
                    "default": "fastestFee",
                    "example": "fastestFee"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Bid intent created successfully",
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
                        "bidder": {
                          "type": "object",
                          "properties": {
                            "unsignedBiddingPSBTBase64": {
                              "type": "string",
                              "description": "Unsigned bidding PSBT in base64 format",
                              "example": "cHNidP8BAH0CAAAAAe..."
                            },
                            "unsignedBiddingPSBTHex": {
                              "type": "string",
                              "description": "Unsigned bidding PSBT in hex format"
                            },
                            "bidderPaymentUTXOs": {
                              "type": "array",
                              "description": "Payment UTXOs selected for the bid PSBT",
                              "items": {
                                "type": "object"
                              }
                            }
                          }
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
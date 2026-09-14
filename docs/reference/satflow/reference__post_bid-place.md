<!--
Satflow docs — Place a bid on an inscription or collection
Source: https://docs.satflow.com/reference/post_bid-place.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:45:40.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Place a bid on an inscription or collection

Submit a signed PSBT to place a bid on either a specific inscription or a collection. Collection bids can target the whole collection or specific traits.

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
    "/bid/place": {
      "post": {
        "tags": [
          "Get bidding"
        ],
        "summary": "Place a bid on an inscription or collection",
        "description": "Submit a signed PSBT to place a bid on either a specific inscription or a collection. Collection bids can target the whole collection or specific traits.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [
                  {
                    "type": "object",
                    "title": "Inscription Bid",
                    "required": [
                      "price",
                      "inscriptionId",
                      "bidderAddress",
                      "bidderTokenReceiveAddress",
                      "signedBiddingPSBT"
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
                        "description": "Bidder's payment address",
                        "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                      },
                      "bidderTokenReceiveAddress": {
                        "type": "string",
                        "description": "Address to receive the token if bid is accepted",
                        "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                      },
                      "signedBiddingPSBT": {
                        "type": "string",
                        "description": "Signed bidding PSBT in base64 format",
                        "example": "cHNidP8BAH0CAAAAAe..."
                      },
                      "unsignedBiddingPSBT": {
                        "type": "string",
                        "description": "Unsigned bidding PSBT in base64 format (optional)",
                        "example": "cHNidP8BAH0CAAAAAe..."
                      },
                      "allowedPaymentOutpoints": {
                        "type": "array",
                        "nullable": true,
                        "description": "Optional payment UTXO allowlist used when generating the bid intent. Include the same value returned/supplied to `/intent/bid` so signed PSBT verification can validate allowlisted funding inputs. Omit or send null to leave unset.",
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
                  },
                  {
                    "type": "object",
                    "title": "Collection Bid",
                    "required": [
                      "price",
                      "collectionSlug",
                      "bidderAddress",
                      "bidderTokenReceiveAddress",
                      "bidderAddressPublicKey",
                      "quantity",
                      "metaType",
                      "signedBiddingMessage",
                      "bidExpiry"
                    ],
                    "properties": {
                      "price": {
                        "type": "number",
                        "description": "Unit bid price in satoshis",
                        "example": 100000
                      },
                      "collectionSlug": {
                        "type": "string",
                        "description": "Collection slug to bid on",
                        "example": "bitcoin-puppets"
                      },
                      "bidderAddress": {
                        "type": "string",
                        "description": "Bidder's payment address",
                        "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                      },
                      "bidderTokenReceiveAddress": {
                        "type": "string",
                        "description": "Address to receive the tokens if bid is accepted",
                        "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                      },
                      "bidderAddressPublicKey": {
                        "type": "string",
                        "description": "Bidder's public key",
                        "example": "02abc123def456..."
                      },
                      "buyerScripts": {
                        "type": "array",
                        "description": "Optional Taproot script leaves used to derive custom bidder payment addresses",
                        "items": {
                          "type": "object",
                          "required": [
                            "script"
                          ],
                          "properties": {
                            "type": {
                              "type": "string",
                              "description": "Optional script type hint, for example tr_ms",
                              "example": "tr_ms"
                            },
                            "script": {
                              "type": "string",
                              "description": "Taproot leaf script as hex",
                              "example": "2011b1656bff2bcf23b8d292daa173fe4c0356ced9fd5075328c9606ee379a4dbb"
                            }
                          }
                        }
                      },
                      "allowedPaymentOutpoints": {
                        "type": "array",
                        "nullable": true,
                        "description": "Optional payment UTXO allowlist used for bid funding validation and later accept verification. Omit or send null to leave unset.",
                        "items": {
                          "type": "string",
                          "pattern": "^[0-9a-fA-F]{64}:[0-9]+$"
                        },
                        "example": [
                          "4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a99887766554433221100ffe:0"
                        ]
                      },
                      "quantity": {
                        "type": "number",
                        "description": "Quantity of items to bid on",
                        "example": 5
                      },
                      "metaType": {
                        "type": "string",
                        "enum": [
                          "runes",
                          "ordinals"
                        ],
                        "description": "Type of assets being bid on",
                        "example": "ordinals"
                      },
                      "signedBiddingMessage": {
                        "type": "string",
                        "description": "Signed bidding message for verification",
                        "example": "H1234567890abcdef..."
                      },
                      "bidChallengeId": {
                        "type": "string",
                        "description": "Optional server-issued bid challenge ID. New integrations should use this. Existing clients may continue sending timestamp instead.\n",
                        "example": "9b7a9a0d-8d63-4863-9f3f-4ff5b9f73525"
                      },
                      "timestamp": {
                        "type": "number",
                        "description": "Legacy client timestamp when the bid was created. Existing REST clients can continue sending this unchanged. Provide either timestamp or bidChallengeId.\n",
                        "example": 1640995200000
                      },
                      "bidExpiry": {
                        "type": "number",
                        "description": "Timestamp when the bid expires",
                        "example": 1641081600000
                      },
                      "attribute": {
                        "type": "object",
                        "description": "Optional legacy single-trait bid selector",
                        "properties": {
                          "trait_type": {
                            "type": "string",
                            "example": "Background"
                          },
                          "value": {
                            "type": "string",
                            "example": "Blue"
                          }
                        }
                      },
                      "attributes": {
                        "type": "array",
                        "description": "Optional trait bid selectors. When provided, Satflow creates one bid order per trait entry using the same price/quantity.\n",
                        "items": {
                          "type": "object",
                          "properties": {
                            "trait_type": {
                              "type": "string",
                              "example": "Background"
                            },
                            "value": {
                              "type": "string",
                              "example": "Blue"
                            }
                          }
                        }
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
                      },
                      "skipBroadcast": {
                        "type": "boolean",
                        "description": "Whether to skip broadcasting the transaction",
                        "default": false
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Bid placed successfully",
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
                        "message": {
                          "type": "string",
                          "description": "Success message",
                          "example": "Successfully bid!"
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
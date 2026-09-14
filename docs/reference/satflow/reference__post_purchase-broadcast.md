<!--
Satflow docs — Broadcast purchase transaction (signed PSBT)
Source: https://docs.satflow.com/reference/post_purchase-broadcast.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Broadcast purchase transaction (signed PSBT)

Broadcasts a signed purchase PSBT to complete the transaction. Used for both secure and non-secure purchases.

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
    "/purchase/broadcast": {
      "post": {
        "tags": [
          "Make a purchase"
        ],
        "summary": "Broadcast purchase transaction (signed PSBT)",
        "description": "Broadcasts a signed purchase PSBT to complete the transaction. Used for both secure and non-secure purchases.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "buyerAddress",
                  "buyerTokenReceiveAddress",
                  "buyerTokenReceivePublicKey",
                  "feeRate"
                ],
                "properties": {
                  "inscriptionIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Array of inscription IDs being purchased",
                    "example": [
                      "abc123def456...",
                      "def456ghi789..."
                    ]
                  },
                  "runesOutputs": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Array of runes outputs being purchased",
                    "example": [
                      "txid:vout",
                      "txid2:vout2"
                    ]
                  },
                  "signedBulkBuyingPSBT": {
                    "type": "string",
                    "description": "Signed bulk buying PSBT in base64 format",
                    "example": "cHNidP8BAH0CAAAAAe..."
                  },
                  "signedSecurePaymentPrepPSBTs": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Array of signed secure payment preparation PSBTs"
                  },
                  "signedSecurePurchasePSBTs": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Array of signed secure purchase PSBTs"
                  },
                  "signedSecureTransferPSBT": {
                    "type": "string",
                    "description": "Signed secure transfer PSBT"
                  },
                  "unsignedBulkBuyingPSBT": {
                    "type": "string",
                    "description": "Unsigned bulk buying PSBT in base64 format"
                  },
                  "unsignedExtractionPSBT": {
                    "type": "string",
                    "description": "Unsigned extraction PSBT in base64 format"
                  },
                  "signedExtractionPSBT": {
                    "type": "string",
                    "description": "Signed extraction PSBT in base64 format"
                  },
                  "securePurchase": {
                    "type": "boolean",
                    "description": "Whether this is a secure purchase",
                    "default": false
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
                  "buyerTokenReceivePublicKey": {
                    "type": "string",
                    "description": "Public key for token receive address",
                    "example": "02def456ghi789..."
                  },
                  "buyerPublicKey": {
                    "type": "string",
                    "nullable": true,
                    "description": "Buyer's internal public key, or null when buyerScripts defines a NUMS Taproot wallet",
                    "example": "02abc123def456..."
                  },
                  "buyerScripts": {
                    "type": "array",
                    "description": "Optional Taproot script leaves used to derive custom buyer addresses",
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
                  "feeRate": {
                    "description": "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n",
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
                        "minimum": 0.01
                      }
                    ],
                    "example": "fastestFee"
                  },
                  "extractionFeeRate": {
                    "description": "Extraction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n",
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
                        "minimum": 0.01
                      }
                    ],
                    "example": "fastestFee"
                  },
                  "minimalOutputs": {
                    "type": "boolean",
                    "description": "Use minimal outputs optimization"
                  },
                  "lightspeed": {
                    "type": "boolean",
                    "description": "Use lightspeed mode"
                  },
                  "isExtracted": {
                    "type": "boolean",
                    "description": "Whether tokens have been extracted"
                  },
                  "splitQuantity": {
                    "type": "number",
                    "description": "Number of output splits",
                    "example": 10
                  },
                  "referralAddress": {
                    "type": "string",
                    "description": "Locked referral address from the secure intent response",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  },
                  "creatorFee": {
                    "type": "boolean",
                    "description": "Locked creator-fee flag from the secure intent response"
                  },
                  "skipBroadcast": {
                    "type": "boolean",
                    "description": "Whether to skip broadcasting the transaction",
                    "default": false
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Purchase transaction broadcasted successfully",
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
                          "description": "Transaction ID of the broadcast purchase"
                        },
                        "unsignedExtractionPSBTBase64": {
                          "type": "string",
                          "description": "Unsigned extraction PSBT if extraction is needed"
                        },
                        "unsignedExtractionPSBTHex": {
                          "type": "string",
                          "description": "Unsigned extraction PSBT in hex format"
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
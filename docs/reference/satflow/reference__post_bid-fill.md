<!--
Satflow docs — Fill/accept a bid
Source: https://docs.satflow.com/reference/post_bid-fill.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Fill/accept a bid

Submit signed PSBT to fill/accept either an inscription bid or collection bid (including trait-constrained collection bids) and broadcast the item sale. The endpoint automatically detects the bid type based on the provided parameters.

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
    "/bid/fill": {
      "post": {
        "tags": [
          "Sell listing"
        ],
        "summary": "Fill/accept a bid",
        "description": "Submit signed PSBT to fill/accept either an inscription bid or collection bid (including trait-constrained collection bids) and broadcast the item sale. The endpoint automatically detects the bid type based on the provided parameters.",
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
                      "sellerOrdAddress",
                      "sellerReceiveAddress",
                      "sellerPublicKey",
                      "signedAcceptedBidPSBT"
                    ],
                    "properties": {
                      "price": {
                        "type": "number",
                        "description": "Bid price in satoshis",
                        "example": 100000
                      },
                      "inscriptionId": {
                        "type": "string",
                        "description": "Inscription ID for the bid",
                        "example": "abc123def456..."
                      },
                      "sellerOrdAddress": {
                        "type": "string",
                        "description": "Seller's ordinal address",
                        "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                      },
                      "sellerReceiveAddress": {
                        "type": "string",
                        "description": "Address to receive payment",
                        "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                      },
                      "sellerPaymentAddress": {
                        "type": "string",
                        "description": "Optional payment address for split-address payouts. Requires signedAcceptBidExtractionPSBT when it differs from sellerReceiveAddress.",
                        "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                      },
                      "sellerPublicKey": {
                        "type": "string",
                        "description": "Seller's public key",
                        "example": "abc123def456..."
                      },
                      "signedAcceptedBidPSBT": {
                        "type": "string",
                        "description": "Signed accept bid PSBT in base64 format",
                        "example": "cHNidP8BAH0CAAAAAe..."
                      },
                      "unsignedAcceptBidPSBT": {
                        "type": "string",
                        "description": "Unsigned accept bid PSBT in base64 format (optional)",
                        "example": "cHNidP8BAH0CAAAAAe..."
                      },
                      "signedAcceptBidExtractionPSBT": {
                        "type": "string",
                        "description": "Signed extraction PSBT in base64 format. Required when proceeds move to sellerPaymentAddress.",
                        "example": "cHNidP8BAH0CAAAAAe..."
                      },
                      "unsignedAcceptBidExtractionPSBT": {
                        "type": "string",
                        "description": "Unsigned extraction PSBT in base64 format (optional)",
                        "example": "cHNidP8BAH0CAAAAAe..."
                      },
                      "referralAddress": {
                        "type": "string",
                        "description": "Referral address for commission (optional)",
                        "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                      },
                      "skipBroadcast": {
                        "type": "boolean",
                        "description": "Whether to skip broadcasting the transaction",
                        "default": false
                      }
                    }
                  },
                  {
                    "type": "object",
                    "title": "Collection Bid",
                    "required": [
                      "metaType",
                      "bids",
                      "signedAcceptCollectionBidPSBT",
                      "unsignedAcceptCollectionBidPSBT"
                    ],
                    "properties": {
                      "metaType": {
                        "type": "string",
                        "enum": [
                          "runes",
                          "ordinals"
                        ],
                        "description": "Type of assets being traded",
                        "example": "ordinals"
                      },
                      "bids": {
                        "type": "array",
                        "description": "Array of collection bids to fill",
                        "items": {
                          "type": "object",
                          "required": [
                            "_id",
                            "seller",
                            "bidder"
                          ],
                          "properties": {
                            "_id": {
                              "type": "string",
                              "description": "Bid ID"
                            },
                            "seller": {
                              "type": "object",
                              "properties": {
                                "collectionSlug": {
                                  "type": "string"
                                },
                                "sellerOrdAddress": {
                                  "type": "string"
                                },
                                "sellerPaymentAddress": {
                                  "type": "string"
                                },
                                "sellerPaymentAddressPublicKey": {
                                  "type": "string"
                                },
                                "sellerOrdinalsAddressPublicKey": {
                                  "type": "string"
                                },
                                "inscriptionIds": {
                                  "type": "array",
                                  "items": {
                                    "type": "string"
                                  }
                                },
                                "runeOutputs": {
                                  "type": "array",
                                  "items": {
                                    "type": "string"
                                  }
                                },
                                "fillQuantity": {
                                  "type": "number"
                                }
                              }
                            },
                            "bidder": {
                              "type": "object",
                              "properties": {
                                "collectionSlug": {
                                  "type": "string"
                                },
                                "bidderAddress": {
                                  "type": "string"
                                },
                                "bidderTokenReceiveAddress": {
                                  "type": "string"
                                },
                                "unitPrice": {
                                  "type": "number"
                                },
                                "quantity": {
                                  "type": "number"
                                },
                                "attribute": {
                                  "type": "object",
                                  "description": "Optional trait constraint for trait bids",
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
                              }
                            }
                          }
                        }
                      },
                      "feeInfo": {
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
                        "default": "fastestFee",
                        "example": "fastestFee"
                      },
                      "signedAcceptCollectionBidPSBT": {
                        "type": "string",
                        "description": "Signed accept collection bid PSBT in base64 format",
                        "example": "cHNidP8BAH0CAAAAAe..."
                      },
                      "unsignedAcceptCollectionBidPSBT": {
                        "type": "string",
                        "description": "Unsigned accept collection bid PSBT in base64 format",
                        "example": "cHNidP8BAH0CAAAAAe..."
                      },
                      "referralAddress": {
                        "type": "string",
                        "description": "Referral address for commission (optional)",
                        "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
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
            "description": "Bid filled successfully",
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
                        "txid": {
                          "type": "string",
                          "description": "Transaction ID of the broadcast transaction"
                        },
                        "success": {
                          "type": "boolean",
                          "description": "Whether the bid was successfully filled"
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
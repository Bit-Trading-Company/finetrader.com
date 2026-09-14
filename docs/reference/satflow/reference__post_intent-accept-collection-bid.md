<!--
Satflow docs — Create accept collection bid intent (unsigned PSBT)
Source: https://docs.satflow.com/reference/post_intent-accept-collection-bid.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Create accept collection bid intent (unsigned PSBT)

Creates an unsigned PSBT for accepting collection bids that needs to be signed by the seller

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
    "/intent/accept-collection-bid": {
      "post": {
        "tags": [
          "Get bidding"
        ],
        "summary": "Create accept collection bid intent (unsigned PSBT)",
        "description": "Creates an unsigned PSBT for accepting collection bids that needs to be signed by the seller",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "metaType",
                  "bids"
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
                    "description": "Array of collection bids to accept",
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
                  "referralAddress": {
                    "type": "string",
                    "description": "Referral address for commission (optional)"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Accept collection bid intent created successfully"
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
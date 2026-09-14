<!--
Satflow docs — Submit signed Satflow listing PSBTs
Source: https://docs.satflow.com/reference/post_list.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Submit signed Satflow listing PSBTs

Submit signed listing PSBTs to create active listings on the marketplace

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
    "/list": {
      "post": {
        "tags": [
          "Create listing"
        ],
        "summary": "Submit signed Satflow listing PSBTs",
        "description": "Submit signed listing PSBTs to create active listings on the marketplace",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "listings",
                  "signedListingPSBT",
                  "signedSecureListingPSBTs"
                ],
                "properties": {
                  "listings": {
                    "type": "array",
                    "description": "Array of listing objects",
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
                          "description": "Listing price in satoshis",
                          "example": 100000
                        },
                        "inscriptionId": {
                          "type": "string",
                          "description": "Inscription ID to list",
                          "example": "abc123def456..."
                        },
                        "runesOutput": {
                          "type": "string",
                          "description": "Runes output to list",
                          "example": "txid:vout"
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
                  },
                  "signedListingPSBT": {
                    "type": "string",
                    "description": "Signed listing PSBT in base64 format",
                    "example": "cHNidP8BAH0CAAAAAe..."
                  },
                  "unsignedListingPSBT": {
                    "type": "string",
                    "description": "Unsigned listing PSBT in base64 format (optional)",
                    "example": "cHNidP8BAH0CAAAAAe..."
                  },
                  "signedSecureListingPSBTs": {
                    "type": "array",
                    "description": "Array of signed secure listing PSBTs",
                    "items": {
                      "type": "string",
                      "description": "Signed secure listing PSBT in base64 format",
                      "example": "cHNidP8BAH0CAAAAAe..."
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Listings created successfully",
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
                          "description": "Transaction ID of the broadcast listing"
                        },
                        "listings": {
                          "type": "array",
                          "description": "Created listing objects",
                          "items": {
                            "type": "object",
                            "properties": {
                              "_id": {
                                "type": "string",
                                "description": "Listing ID"
                              },
                              "price": {
                                "type": "number",
                                "description": "Listing price"
                              },
                              "inscriptionId": {
                                "type": "string",
                                "description": "Inscription ID"
                              },
                              "status": {
                                "type": "string",
                                "description": "Listing status"
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
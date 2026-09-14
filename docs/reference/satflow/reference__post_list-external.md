<!--
Satflow docs — Submit signed external marketplace listing PSBTs
Source: https://docs.satflow.com/reference/post_list-external.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Submit signed external marketplace listing PSBTs

Legacy Magic Eden listing endpoint. Magic Eden is deprecated and blocked by default unless `MAGIC_EDEN_DISABLED=false`.

<Banner isInline={true} message="External marketplace endpoints depend on external API providers. They are not guaranteed to be reliable and may be deprecated without notice." color="#bb0000" textColor="#ffffff" fontSize="14px" fontWeight="bold" />

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
    "/list/external": {
      "post": {
        "tags": [
          "Create listing"
        ],
        "summary": "Submit signed external marketplace listing PSBTs",
        "deprecated": true,
        "description": "Legacy Magic Eden listing endpoint. Magic Eden is deprecated and blocked by default unless `MAGIC_EDEN_DISABLED=false`.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "listings",
                  "signedCombinedPSBT",
                  "sellerPublicKey",
                  "sellerOrdAddress",
                  "receiveAddress",
                  "type",
                  "marketplace",
                  "signedMessage",
                  "unsignedMessage"
                ],
                "properties": {
                  "listings": {
                    "oneOf": [
                      {
                        "type": "object",
                        "title": "Runes Listings",
                        "description": "Runes listings mapped by rune name. All properties from /intent/external-sell `results` array for this listing must be included.",
                        "additionalProperties": {
                          "type": "object",
                          "properties": {
                            "orderPsbtBase64": {
                              "type": "string",
                              "description": "Order PSBT in base64 format"
                            },
                            "signedRBFProtectedPsbts": {
                              "type": "array",
                              "items": {
                                "type": "string"
                              },
                              "description": "Array of signed RBF-protected PSBTs"
                            },
                            "signedRBFProtectedTransientPsbts": {
                              "type": "array",
                              "items": {
                                "type": "string"
                              },
                              "description": "Array of signed RBF-protected transient PSBTs"
                            }
                          }
                        }
                      },
                      {
                        "type": "array",
                        "title": "Ordinals Listings",
                        "description": "Array of listings, taken from mpState and combined with signed PSBTs",
                        "minItems": 1,
                        "items": {
                          "type": "object",
                          "description": "Ordinal listing object with signed PSBTs. All properties from /intent/external-sell `results` array for this listing must be included.",
                          "properties": {
                            "inscriptionId": {
                              "type": "string",
                              "description": "Inscription ID being listed"
                            },
                            "price": {
                              "type": "number",
                              "description": "Listing price in satoshis"
                            },
                            "sellerReceiveAddress": {
                              "type": "string",
                              "description": "Seller's receive address"
                            },
                            "signedRBFProtectedListingPSBT": {
                              "type": "string",
                              "description": "Signed RBF-protected listing PSBT in base64 or hex format"
                            },
                            "signedRBFProtectedListingTransientPSBT": {
                              "type": "string",
                              "description": "Signed RBF-protected transient listing PSBT in base64 or hex format"
                            }
                          }
                        }
                      }
                    ]
                  },
                  "signedCombinedPSBT": {
                    "type": "string",
                    "description": "Signed combined PSBT in base64 or hex format",
                    "example": "cHNidP8BAH0CAAAAAe..."
                  },
                  "sellerPublicKey": {
                    "type": "string",
                    "description": "Seller's public key",
                    "example": "02abc123def456..."
                  },
                  "sellerOrdAddress": {
                    "type": "string",
                    "description": "Seller's ordinal address",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  },
                  "receiveAddress": {
                    "type": "string",
                    "description": "Address to receive payment",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "runes",
                      "ordinals"
                    ],
                    "description": "Type of assets being listed",
                    "example": "ordinals"
                  },
                  "marketplace": {
                    "type": "string",
                    "enum": [
                      "magiceden"
                    ],
                    "description": "Legacy external marketplace name (deprecated)",
                    "example": "magiceden"
                  },
                  "signedMessage": {
                    "type": "string",
                    "description": "Signed authentication message"
                  },
                  "unsignedMessage": {
                    "type": "string",
                    "description": "Unsigned authentication message"
                  },
                  "sessionId": {
                    "type": "string",
                    "description": "Session ID to maintain state across requests",
                    "example": "12345"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "External listings created successfully",
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
                      "description": "External listing submission response",
                      "properties": {
                        "success": {
                          "type": "boolean",
                          "example": true
                        },
                        "externalAuthToken": {
                          "type": "string",
                          "description": "External authentication token. Can be supplied as X-External-Auth header in future requests to prevent re-authentication"
                        },
                        "externalAuthAddress": {
                          "type": "string",
                          "description": "Address which `externalAuthToken` is tied to"
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
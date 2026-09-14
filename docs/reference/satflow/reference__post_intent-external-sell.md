<!--
Satflow docs — Create external marketplace listing intent (unsigned PSBTs)
Source: https://docs.satflow.com/reference/post_intent-external-sell.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Create external marketplace listing intent (unsigned PSBTs)

Legacy Magic Eden listing intent endpoint. Magic Eden is deprecated and blocked by default unless `MAGIC_EDEN_DISABLED=false`.

<br />

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
    "/intent/external-sell": {
      "post": {
        "tags": [
          "Create listing"
        ],
        "summary": "Create external marketplace listing intent (unsigned PSBTs)",
        "deprecated": true,
        "description": "Legacy Magic Eden listing intent endpoint. Magic Eden is deprecated and blocked by default unless `MAGIC_EDEN_DISABLED=false`.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "listings",
                  "sellerOrdAddress",
                  "receiveAddress",
                  "sellerPublicKey",
                  "marketplace"
                ],
                "properties": {
                  "listings": {
                    "type": "array",
                    "minItems": 1,
                    "description": "Array of listings to create for external marketplace",
                    "items": {
                      "type": "object",
                      "required": [
                        "price"
                      ],
                      "properties": {
                        "price": {
                          "type": "number",
                          "description": "Listing price in satoshis (must be positive)",
                          "example": 100000
                        },
                        "tokenId": {
                          "type": "string",
                          "description": "Token ID (inscription ID) to list (optional)",
                          "example": "abc123def456..."
                        },
                        "runesOutput": {
                          "type": "string",
                          "description": "Runes output to list (optional)",
                          "example": "txid:vout"
                        }
                      }
                    }
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
                  "sellerPublicKey": {
                    "type": "string",
                    "description": "Seller's public key",
                    "example": "02abc123def456..."
                  },
                  "marketplace": {
                    "type": "string",
                    "enum": [
                      "magiceden"
                    ],
                    "description": "Legacy external marketplace name (deprecated)",
                    "example": "magiceden"
                  },
                  "sessionId": {
                    "type": "string",
                    "description": "Session ID from previous requests (optional)",
                    "example": "session_abc123"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "External sell intent created successfully",
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
                      "description": "Legacy Magic Eden listing intent response",
                      "properties": {
                        "success": {
                          "type": "boolean",
                          "example": true
                        },
                        "type": {
                          "type": "string",
                          "enum": [
                            "ordinals",
                            "runes"
                          ],
                          "description": "Type of assets being listed"
                        },
                        "results": {
                          "type": "array",
                          "description": "Array of listing results",
                          "items": {
                            "type": "object",
                            "description": "Listing result (structure varies by type)",
                            "properties": {
                              "unsignedCombinedPSBTBase64": {
                                "type": "string",
                                "description": "Unsigned combined PSBT in base64 format (ordinals only)"
                              },
                              "unsignedListingPSBTBase64": {
                                "type": "string",
                                "description": "Unsigned listing PSBT in base64 format (ordinals only)"
                              },
                              "tokenId": {
                                "type": "string",
                                "description": "Token/Inscription ID (ordinals only)"
                              },
                              "price": {
                                "type": "number",
                                "description": "Listing price in satoshis"
                              },
                              "sellerReceiveAddress": {
                                "type": "string",
                                "description": "Seller's receive address (ordinals only)"
                              },
                              "runeName": {
                                "type": "string",
                                "description": "Name of the rune (runes only)"
                              },
                              "orderPsbtBase64": {
                                "type": "string",
                                "description": "Order PSBT in base64 format (runes only)"
                              },
                              "unsignedRBFProtectedPsbts": {
                                "type": "array",
                                "items": {
                                  "type": "string"
                                },
                                "description": "Array of unsigned RBF-protected PSBTs (runes only)"
                              },
                              "makerReceiveAddress": {
                                "type": "string",
                                "description": "Maker's receive address (runes only)"
                              },
                              "makerRunesAddress": {
                                "type": "string",
                                "description": "Maker's runes address (runes only)"
                              }
                            }
                          }
                        },
                        "messageToSign": {
                          "type": "string",
                          "description": "Message that needs to be signed using BIP-322 and included in the submit request"
                        },
                        "externalAuthToken": {
                          "type": "string",
                          "description": "A token which can be supplied in subsequent requests via X-External-Auth header to maintain authentication"
                        },
                        "externalAuthAddress": {
                          "type": "string",
                          "description": "The address which `externalAuthToken` is tied to, and which must sign the `messageToSign`"
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
          }
        }
      }
    }
  }
}
```
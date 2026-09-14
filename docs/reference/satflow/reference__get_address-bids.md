<!--
Satflow docs — Get active bids for an address
Source: https://docs.satflow.com/reference/get_address-bids.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get active bids for an address

Returns an array of active bids placed by the specified address

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
    "/address/bids": {
      "get": {
        "tags": [
          "Get bidding"
        ],
        "summary": "Get active bids for an address",
        "description": "Returns an array of active bids placed by the specified address",
        "parameters": [
          {
            "in": "query",
            "name": "address",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "The wallet address to get bids for",
            "example": "bc1p..."
          }
        ],
        "responses": {
          "200": {
            "description": "Active bids retrieved successfully",
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
                        "results": {
                          "type": "array",
                          "description": "Array of active bids for the provided address",
                          "items": {
                            "type": "object",
                            "properties": {
                              "bid_id": {
                                "type": "string",
                                "description": "Bid ID",
                                "example": "507f1f77bcf86cd799439011"
                              },
                              "inscription_id": {
                                "type": "string",
                                "nullable": true,
                                "description": "Inscription ID for item-specific bids (null for collection bids)",
                                "example": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"
                              },
                              "price": {
                                "type": "number",
                                "description": "Bid price in satoshis",
                                "example": 1000000
                              },
                              "type": {
                                "type": "string",
                                "enum": [
                                  "individual",
                                  "collection",
                                  "rune"
                                ],
                                "description": "Bid type",
                                "example": "collection"
                              },
                              "isNonCustodial": {
                                "type": "boolean",
                                "description": "Whether bid is non-custodial",
                                "example": false
                              },
                              "expiration": {
                                "type": "number",
                                "nullable": true,
                                "description": "Expiration timestamp in milliseconds",
                                "example": 1735776000000
                              },
                              "attribute": {
                                "type": "object",
                                "nullable": true,
                                "description": "Trait selector for trait bids",
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
                              "inscription_metadata": {
                                "type": "object",
                                "nullable": true,
                                "description": "Metadata payload for display"
                              },
                              "runes_metadata": {
                                "type": "object",
                                "nullable": true,
                                "description": "Rune metadata when type is rune"
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
          "404": {
            "description": "Address not found or no bids",
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
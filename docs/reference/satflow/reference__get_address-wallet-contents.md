<!--
Satflow docs — Get wallet contents
Source: https://docs.satflow.com/reference/get_address-wallet-contents.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get wallet contents

Returns the contents of a wallet including ordinals and runes with optional filtering and pagination

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
    "/address/wallet-contents": {
      "get": {
        "tags": [
          "Get wallet"
        ],
        "summary": "Get wallet contents",
        "description": "Returns the contents of a wallet including ordinals and runes with optional filtering and pagination",
        "parameters": [
          {
            "in": "query",
            "name": "address",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "The wallet address to get contents for",
            "example": "bc1p..."
          },
          {
            "in": "query",
            "name": "itemType",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "inscription",
                "rune",
                "all"
              ]
            },
            "description": "Filter by item type",
            "example": "all"
          },
          {
            "in": "query",
            "name": "collection",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "Filter by collection slug",
            "example": "bitcoin-frogs"
          },
          {
            "in": "query",
            "name": "listedOnly",
            "required": false,
            "schema": {
              "type": "boolean"
            },
            "description": "Only return listed items",
            "example": false
          },
          {
            "in": "query",
            "name": "bidsOnly",
            "required": false,
            "schema": {
              "type": "boolean"
            },
            "description": "Only return items with bids",
            "example": false
          },
          {
            "in": "query",
            "name": "cursor",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "Pagination cursor",
            "example": 0
          },
          {
            "in": "query",
            "name": "limit",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "Number of items to return (default 100)",
            "example": 100
          }
        ],
        "responses": {
          "200": {
            "description": "Wallet contents retrieved successfully",
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
                          "type": "object",
                          "properties": {
                            "ordinals": {
                              "type": "array",
                              "description": "Array of ordinal/inscription items",
                              "items": {
                                "type": "object",
                                "properties": {
                                  "collection": {
                                    "type": "object",
                                    "nullable": true,
                                    "description": "Collection information"
                                  },
                                  "token": {
                                    "type": "object",
                                    "description": "Token details",
                                    "properties": {
                                      "name": {
                                        "type": "string"
                                      },
                                      "inscription_id": {
                                        "type": "string"
                                      },
                                      "inscription_number": {
                                        "type": "integer"
                                      },
                                      "image_url": {
                                        "type": "string"
                                      },
                                      "content_type": {
                                        "type": "string",
                                        "nullable": true
                                      }
                                    }
                                  },
                                  "listing": {
                                    "type": "object",
                                    "nullable": true,
                                    "description": "Listing information if item is listed",
                                    "properties": {
                                      "price": {
                                        "type": "number"
                                      },
                                      "secureListing": {
                                        "type": "boolean"
                                      }
                                    }
                                  },
                                  "market": {
                                    "type": "object",
                                    "nullable": true,
                                    "description": "Market data including bids and floor prices"
                                  }
                                }
                              }
                            },
                            "runes": {
                              "type": "array",
                              "description": "Array of rune items",
                              "items": {
                                "type": "object",
                                "properties": {
                                  "collection": {
                                    "type": "object",
                                    "nullable": true,
                                    "description": "Rune collection information"
                                  },
                                  "token": {
                                    "type": "object",
                                    "description": "Rune token details",
                                    "properties": {
                                      "name": {
                                        "type": "string"
                                      },
                                      "rune_utxo_id": {
                                        "type": "string"
                                      },
                                      "rune_amount": {
                                        "type": "string"
                                      },
                                      "rune_symbol": {
                                        "type": "string"
                                      },
                                      "rune_amount_formatted": {
                                        "type": "number"
                                      },
                                      "rune_divisibility": {
                                        "type": "integer"
                                      },
                                      "output": {
                                        "type": "string"
                                      }
                                    }
                                  },
                                  "listing": {
                                    "type": "object",
                                    "nullable": true,
                                    "description": "Listing information if rune is listed",
                                    "properties": {
                                      "price": {
                                        "type": "number"
                                      },
                                      "price_per_rune_sats": {
                                        "type": "number"
                                      }
                                    }
                                  },
                                  "market": {
                                    "type": "object",
                                    "nullable": true,
                                    "description": "Market data for the rune"
                                  }
                                }
                              }
                            }
                          }
                        },
                        "pending_orders": {
                          "type": "array",
                          "description": "Array of pending orders",
                          "items": {
                            "type": "object"
                          }
                        },
                        "nextCursor": {
                          "type": "integer",
                          "nullable": true,
                          "description": "Cursor for next page of results",
                          "example": 1
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
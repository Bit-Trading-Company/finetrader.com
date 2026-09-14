<!--
Satflow docs — Get details for item
Source: https://docs.satflow.com/reference/get_item.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get details for item

Returns ordinal inscription data, metadata for token and collection, listing data, and bid data based on query parameters

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
    "/item": {
      "get": {
        "tags": [
          "Get item"
        ],
        "summary": "Get details for item",
        "description": "Returns ordinal inscription data, metadata for token and collection, listing data, and bid data based on query parameters",
        "parameters": [
          {
            "in": "query",
            "name": "inscriptionId",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "Ordinal inscription id",
            "example": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"
          },
          {
            "in": "query",
            "name": "inscriptionNumber",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "Ordinal inscription number",
            "example": "12345"
          },
          {
            "in": "query",
            "name": "metadata",
            "required": false,
            "schema": {
              "type": "boolean",
              "default": false
            },
            "description": "Include metadata for this item in the response",
            "example": true
          },
          {
            "in": "query",
            "name": "bid",
            "required": false,
            "schema": {
              "type": "boolean",
              "default": false
            },
            "description": "Include bid information for this item in the response",
            "example": true
          },
          {
            "in": "query",
            "name": "listing",
            "required": false,
            "schema": {
              "type": "boolean",
              "default": false
            },
            "description": "Include listing information for this item in the response",
            "example": true
          },
          {
            "in": "query",
            "name": "exclude_ord",
            "required": false,
            "schema": {
              "type": "boolean",
              "default": false
            },
            "description": "Exclude ordinals data from the response",
            "example": true
          }
        ],
        "responses": {
          "200": {
            "description": "Inscription data retrieved successfully",
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
                        "id": {
                          "type": "string",
                          "description": "Inscription ID",
                          "example": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"
                        },
                        "inscriptionNumber": {
                          "type": "string",
                          "description": "Inscription number",
                          "example": "12345"
                        },
                        "contentType": {
                          "type": "string",
                          "description": "Content type of the inscription",
                          "example": "image/png"
                        },
                        "contentURI": {
                          "type": "string",
                          "description": "URI to access the inscription content",
                          "example": "https://ord.satflow.com/content/6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"
                        },
                        "contentPreviewURI": {
                          "type": "string",
                          "description": "URI to access the inscription preview",
                          "example": "https://ord.satflow.com/preview/6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"
                        },
                        "genesisTransaction": {
                          "type": "string",
                          "description": "Genesis transaction ID",
                          "example": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799"
                        },
                        "owner": {
                          "type": "string",
                          "description": "Current owner address",
                          "example": "bc1p..."
                        },
                        "location": {
                          "type": "string",
                          "description": "Current location of the inscription",
                          "example": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799:0:0"
                        },
                        "output": {
                          "type": "string",
                          "description": "Output reference",
                          "example": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799:0"
                        },
                        "outputValue": {
                          "type": "number",
                          "description": "Output value in satoshis",
                          "example": 546
                        },
                        "listed": {
                          "type": "boolean",
                          "description": "Whether the inscription is currently listed (only included if listing=true)",
                          "example": true
                        },
                        "listing": {
                          "type": "object",
                          "description": "Listing data (only included if listing=true and item is listed)",
                          "nullable": true,
                          "properties": {
                            "price": {
                              "type": "number",
                              "description": "Listing price in satoshis",
                              "example": 1000000
                            },
                            "sellerAddress": {
                              "type": "string",
                              "description": "Seller's ordinal address",
                              "example": "bc1p..."
                            }
                          }
                        },
                        "hasBid": {
                          "type": "boolean",
                          "description": "Whether the inscription has bids (only included if bid=true)",
                          "example": true
                        },
                        "topBid": {
                          "type": "object",
                          "description": "Top bid data (only included if bid=true and item has bids)",
                          "nullable": true,
                          "properties": {
                            "price": {
                              "type": "number",
                              "description": "Bid price in satoshis",
                              "example": 800000
                            },
                            "bidderAddress": {
                              "type": "string",
                              "description": "Bidder's address",
                              "example": "bc1q..."
                            }
                          }
                        },
                        "bids": {
                          "type": "array",
                          "description": "Array of all bids (only included if bid=true)",
                          "items": {
                            "type": "object",
                            "properties": {
                              "price": {
                                "type": "number",
                                "description": "Bid price in satoshis",
                                "example": 800000
                              },
                              "bidderAddress": {
                                "type": "string",
                                "description": "Bidder's address",
                                "example": "bc1q..."
                              }
                            }
                          }
                        },
                        "metadata": {
                          "type": "object",
                          "description": "Token and collection metadata (only included if metadata=true)",
                          "properties": {
                            "token": {
                              "type": "object",
                              "description": "Token metadata"
                            },
                            "collection": {
                              "type": "object",
                              "description": "Collection metadata"
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
            "description": "Inscription not found",
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
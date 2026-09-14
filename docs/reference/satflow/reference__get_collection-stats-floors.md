<!--
Satflow docs — Get collection floor prices
Source: https://docs.satflow.com/reference/get_collection-stats-floors.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get collection floor prices

Returns floor prices for multiple collections by type (ordinals or runes)

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
    "/collection-stats/floors": {
      "get": {
        "tags": [
          "Get collection"
        ],
        "summary": "Get collection floor prices",
        "description": "Returns floor prices for multiple collections by type (ordinals or runes)",
        "parameters": [
          {
            "in": "query",
            "name": "type",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "ordinals",
                "runes"
              ]
            },
            "description": "Type of collections to get floors for",
            "example": "ordinals"
          },
          {
            "in": "query",
            "name": "slugs",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Comma-separated list of collection slugs",
            "example": "bitcoin-puppets,omb"
          }
        ],
        "responses": {
          "200": {
            "description": "Collection floor prices retrieved successfully",
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
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "slug": {
                            "type": "string",
                            "description": "Collection slug identifier",
                            "example": "bitcoin-puppets"
                          },
                          "floor": {
                            "type": "number",
                            "description": "Current floor price in satoshis",
                            "example": 4726300
                          },
                          "listedCount": {
                            "type": "number",
                            "description": "Number of items currently listed",
                            "example": 102
                          },
                          "ownerCount": {
                            "type": "number",
                            "description": "Number of owners of this collection",
                            "example": 256
                          },
                          "oneDayChange": {
                            "type": "number",
                            "description": "Percentage change in floor price over the last 24 hours",
                            "example": 2.5
                          },
                          "sevenDayChange": {
                            "type": "number",
                            "description": "Percentage change in floor price over the last 7 days",
                            "example": -1.2
                          },
                          "timestamp": {
                            "type": "string",
                            "description": "Time of the floor price data point",
                            "example": "2023-10-01T12:00:00Z"
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
                  "type": "object",
                  "properties": {
                    "error": {
                      "type": "string",
                      "example": "Type and slugs parameters are required"
                    },
                    "code": {
                      "type": "string",
                      "example": "BAD_REQUEST"
                    }
                  }
                }
              }
            }
          },
          "404": {
            "description": "Collections not found",
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
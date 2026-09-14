<!--
Satflow docs — Get inscription IDs for a collection
Source: https://docs.satflow.com/reference/get_collection-inscription-ids.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get inscription IDs for a collection

Returns inscription IDs for a collection in deterministic inscription-number order using offset pagination

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
    "/collection/inscription-ids": {
      "get": {
        "tags": [
          "Get collection"
        ],
        "summary": "Get inscription IDs for a collection",
        "description": "Returns inscription IDs for a collection in deterministic inscription-number order using offset pagination",
        "parameters": [
          {
            "in": "query",
            "name": "collection_id",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Collection identifier",
            "example": "nodemonkes"
          },
          {
            "in": "query",
            "name": "cursor",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 0,
              "minimum": 0
            },
            "description": "Zero-based offset for pagination",
            "example": 0
          },
          {
            "in": "query",
            "name": "limit",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1000,
              "maximum": 1000,
              "minimum": 1
            },
            "description": "Maximum number of inscription IDs to return per page",
            "example": 1000
          },
          {
            "in": "query",
            "name": "sort",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "asc",
                "desc"
              ],
              "default": "asc"
            },
            "description": "Sort order by inscription number",
            "example": "asc"
          }
        ],
        "responses": {
          "200": {
            "description": "Collection inscription IDs retrieved successfully",
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
                        "collectionId": {
                          "type": "string",
                          "description": "Collection identifier",
                          "example": "nodemonkes"
                        },
                        "inscriptionIds": {
                          "type": "array",
                          "description": "Ordered inscription IDs for the requested page",
                          "items": {
                            "type": "string",
                            "example": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"
                          }
                        },
                        "nextCursor": {
                          "type": "integer",
                          "nullable": true,
                          "description": "Next offset to request, or null when the page is exhausted",
                          "example": 1000
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
            "description": "Collection not found",
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
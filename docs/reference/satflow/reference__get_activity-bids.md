<!--
Satflow docs — Get bid activity data
Source: https://docs.satflow.com/reference/get_activity-bids.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get bid activity data

Returns bid activity data with optional filtering and pagination

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
      },
      "ActivityQueryParams": {
        "type": "object",
        "properties": {
          "collectionSlug": {
            "type": "string",
            "description": "Filter by collection slug",
            "example": "bitcoin-puppets"
          },
          "group": {
            "type": "string",
            "enum": [
              "collection",
              "time"
            ],
            "description": "Group results by collection or time",
            "example": "collection"
          },
          "active": {
            "type": "boolean",
            "default": true,
            "description": "Filter for active items only",
            "example": true
          },
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number for pagination",
            "example": 1
          },
          "pageSize": {
            "type": "integer",
            "default": 100,
            "description": "Number of items per page",
            "example": 50
          },
          "external": {
            "type": "boolean",
            "default": false,
            "description": "Include external marketplace data",
            "example": false
          },
          "timeRange": {
            "type": "string",
            "enum": [
              "24h",
              "7d",
              "30d"
            ],
            "description": "Time range filter",
            "example": "24h"
          },
          "includeOnlyCollectionItems": {
            "type": "boolean",
            "default": false,
            "description": "Include only items from collections",
            "example": false
          },
          "sortBy": {
            "type": "string",
            "enum": [
              "createdAt",
              "fillCompletedAt",
              "fillPendingAt",
              "price",
              "unitPrice"
            ],
            "description": "Field to sort by",
            "example": "createdAt"
          },
          "sortDirection": {
            "type": "string",
            "enum": [
              "asc",
              "desc"
            ],
            "default": "desc",
            "description": "Sort direction",
            "example": "desc"
          }
        }
      },
      "ActivityResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "example": true
          },
          "data": {
            "type": "object",
            "properties": {
              "items": {
                "type": "array",
                "description": "Array of activity items",
                "items": {
                  "type": "object",
                  "properties": {
                    "_id": {
                      "type": "string",
                      "description": "Activity item ID",
                      "example": "507f1f77bcf86cd799439011"
                    },
                    "inscriptionId": {
                      "type": "string",
                      "description": "Inscription ID",
                      "example": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"
                    },
                    "price": {
                      "type": "number",
                      "description": "Price in satoshis",
                      "example": 1000000
                    },
                    "timestamp": {
                      "type": "string",
                      "format": "date-time",
                      "description": "Activity timestamp",
                      "example": "2023-12-01T10:00:00Z"
                    },
                    "type": {
                      "type": "string",
                      "description": "Activity type",
                      "example": "sale"
                    },
                    "collectionSlug": {
                      "type": "string",
                      "description": "Collection identifier",
                      "example": "bitcoin-puppets"
                    }
                  }
                }
              },
              "pagination": {
                "type": "object",
                "properties": {
                  "page": {
                    "type": "integer",
                    "example": 1
                  },
                  "pageSize": {
                    "type": "integer",
                    "example": 100
                  },
                  "total": {
                    "type": "integer",
                    "example": 1500
                  },
                  "totalPages": {
                    "type": "integer",
                    "example": 15
                  }
                }
              }
            }
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
    "/activity/bids": {
      "get": {
        "tags": [
          "Get activity"
        ],
        "summary": "Get bid activity data",
        "description": "Returns bid activity data with optional filtering and pagination",
        "parameters": [
          {
            "in": "query",
            "name": "collectionSlug",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/collectionSlug"
            }
          },
          {
            "in": "query",
            "name": "group",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/group"
            }
          },
          {
            "in": "query",
            "name": "active",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/active"
            }
          },
          {
            "in": "query",
            "name": "page",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/page"
            }
          },
          {
            "in": "query",
            "name": "pageSize",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/pageSize"
            }
          },
          {
            "in": "query",
            "name": "external",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/external"
            }
          },
          {
            "in": "query",
            "name": "timeRange",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/timeRange"
            }
          },
          {
            "in": "query",
            "name": "includeOnlyCollectionItems",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/includeOnlyCollectionItems"
            }
          },
          {
            "in": "query",
            "name": "sortBy",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/sortBy"
            }
          },
          {
            "in": "query",
            "name": "sortDirection",
            "schema": {
              "$ref": "#/components/schemas/ActivityQueryParams/properties/sortDirection"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Bid activity data retrieved successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ActivityResponse"
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
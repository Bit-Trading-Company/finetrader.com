<!--
Satflow docs — Get asset settings by type and ticker
Source: https://docs.satflow.com/reference/get_asset-settings-type-ticker.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get asset settings by type and ticker

Retrieves existing settings for a given asset, or returns in-memory defaults if none exist.

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
    "/asset-settings/{type}/{ticker}": {
      "get": {
        "tags": [
          "Asset Settings"
        ],
        "summary": "Get asset settings by type and ticker",
        "description": "Retrieves existing settings for a given asset, or returns in-memory defaults if none exist.",
        "parameters": [
          {
            "in": "path",
            "name": "type",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "ordinals",
                "runes",
                "brc20"
              ]
            },
            "description": "The type of the asset."
          },
          {
            "in": "path",
            "name": "ticker",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "The ticker symbol of the asset."
          }
        ],
        "responses": {
          "200": {
            "description": "Successfully retrieved asset settings. Returns default settings if none exist.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "id",
                    "type",
                    "createdAt",
                    "updatedAt"
                  ],
                  "properties": {
                    "id": {
                      "type": "string",
                      "nullable": true,
                      "description": "Unique identifier for the asset settings",
                      "example": "507f1f77bcf86cd799439011"
                    },
                    "type": {
                      "type": "string",
                      "enum": [
                        "ordinals",
                        "runes",
                        "brc20"
                      ],
                      "description": "The type of the asset",
                      "example": "ordinals"
                    },
                    "ticker": {
                      "type": "string",
                      "description": "The ticker symbol of the asset",
                      "example": "PEPE",
                      "nullable": true
                    },
                    "washTrading": {
                      "type": "boolean",
                      "description": "Whether wash trading is enabled for this asset",
                      "example": false,
                      "default": false
                    },
                    "createdAt": {
                      "type": "string",
                      "format": "date-time",
                      "nullable": true,
                      "description": "When the asset settings were created",
                      "example": "2023-01-01T00:00:00.000Z"
                    },
                    "updatedAt": {
                      "type": "string",
                      "format": "date-time",
                      "nullable": true,
                      "description": "When the asset settings were last updated",
                      "example": "2023-01-01T00:00:00.000Z"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid asset type provided.",
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
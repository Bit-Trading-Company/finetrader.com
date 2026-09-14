<!--
Satflow docs — Get collection statistics
Source: https://docs.satflow.com/reference/get_collection-stats.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get collection statistics

Returns collection statistics including floor price, listed count, rolling volume, and metadata

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
    "/collection-stats": {
      "get": {
        "tags": [
          "Get collection"
        ],
        "summary": "Get collection statistics",
        "description": "Returns collection statistics including floor price, listed count, rolling volume, and metadata",
        "parameters": [
          {
            "in": "query",
            "name": "collectionId",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Collection identifier or slug",
            "example": "bitcoin-puppets"
          }
        ],
        "responses": {
          "200": {
            "description": "Collection statistics retrieved successfully",
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
                        "volume1d": {
                          "type": "number",
                          "description": "Rolling 24 hour volume in satoshis",
                          "example": 1952270
                        },
                        "volume1dChange": {
                          "type": "number",
                          "description": "Change in 24 hour volume versus the previous 24 hour window, in satoshis",
                          "example": -5296500
                        },
                        "volume1dChangePercent": {
                          "type": "string",
                          "description": "Percentage change in 24 hour volume versus the previous 24 hour window",
                          "example": "-73.0676"
                        },
                        "volume7d": {
                          "type": "number",
                          "description": "Rolling 7 day volume in satoshis",
                          "example": 53091493
                        },
                        "volume7dChange": {
                          "type": "number",
                          "description": "Change in 7 day volume versus the previous 7 day window, in satoshis",
                          "example": -298725491
                        },
                        "volume7dChangePercent": {
                          "type": "string",
                          "description": "Percentage change in 7 day volume versus the previous 7 day window",
                          "example": "-84.9093"
                        },
                        "volume30d": {
                          "type": "number",
                          "description": "Rolling 30 day volume in satoshis",
                          "example": 798790872
                        },
                        "volume30dChange": {
                          "type": "number",
                          "description": "Change in 30 day volume versus the previous 30 day window, in satoshis",
                          "example": 216755235
                        },
                        "volume30dChangePercent": {
                          "type": "string",
                          "description": "Percentage change in 30 day volume versus the previous 30 day window",
                          "example": "37.2409"
                        },
                        "metadata": {
                          "type": "object",
                          "description": "Full collection metadata object returned by the collection service",
                          "properties": {
                            "_id": {
                              "type": "string",
                              "description": "Internal collection record identifier",
                              "example": "661596fa4c95df346861aabb"
                            },
                            "id": {
                              "type": "string",
                              "description": "Collection slug",
                              "example": "nodemonkes"
                            },
                            "name": {
                              "type": "string",
                              "description": "Collection name",
                              "example": "NodeMonkes"
                            },
                            "description": {
                              "type": "string",
                              "nullable": true,
                              "description": "Collection description",
                              "example": "Unique collectible Monkes on every bitcoin node. First Ordinals 10k."
                            },
                            "image_url": {
                              "type": "string",
                              "nullable": true,
                              "description": "Collection image URL",
                              "example": "https://creator-hub-prod.s3.us-east-2.amazonaws.com/ord-nodemonkes_pfp_1753658525948.png"
                            },
                            "image_url_content_type": {
                              "type": "string",
                              "nullable": true,
                              "description": "Image MIME type",
                              "example": "image/png"
                            },
                            "total_items": {
                              "type": "number",
                              "description": "Total supply of the collection",
                              "example": 10000
                            },
                            "inscription_min": {
                              "type": "number",
                              "nullable": true,
                              "description": "Starting inscription number for the collection",
                              "example": 83522
                            },
                            "inscription_max": {
                              "type": "number",
                              "nullable": true,
                              "description": "Ending inscription number for the collection",
                              "example": 111319
                            },
                            "twitter_username": {
                              "type": "string",
                              "nullable": true,
                              "description": "Collection Twitter username",
                              "example": "nodemonkes"
                            },
                            "external_url": {
                              "type": "string",
                              "nullable": true,
                              "description": "Collection website URL",
                              "example": "https://nodemonkes.com"
                            },
                            "discord_url": {
                              "type": "string",
                              "nullable": true,
                              "description": "Collection Discord invite URL",
                              "example": "https://discord.gg/nodemonkes"
                            },
                            "creator_tips_address": {
                              "type": "string",
                              "nullable": true,
                              "description": "Creator tips payment address",
                              "example": null
                            },
                            "creator_fees_enabled": {
                              "type": "boolean",
                              "description": "Whether creator fees are enabled for the collection",
                              "example": false
                            },
                            "royalties": {
                              "type": "array",
                              "description": "Royalty configuration entries",
                              "items": {
                                "type": "object"
                              },
                              "example": []
                            },
                            "category_attributes": {
                              "type": "array",
                              "description": "Category attribute definitions when available",
                              "items": {
                                "type": "object"
                              },
                              "example": []
                            },
                            "supportsLiquidiumLoans": {
                              "type": "boolean",
                              "nullable": true,
                              "description": "Whether the collection supports Liquidium loans",
                              "example": true
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
            "description": "Invalid collection ID",
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
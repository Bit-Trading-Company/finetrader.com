<!--
Satflow docs — Get details for collection
Source: https://docs.satflow.com/reference/get_collection.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Get details for collection

Returns collection metadata and optionally category attributes based on query parameters

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
    }
  },
  "security": [
    {
      "ApiKeyAuth": []
    }
  ],
  "paths": {
    "/collection": {
      "get": {
        "tags": [
          "Get collection"
        ],
        "summary": "Get details for collection",
        "description": "Returns collection metadata and optionally category attributes based on query parameters",
        "parameters": [
          {
            "in": "query",
            "name": "collection_id",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Collection identifier",
            "example": "bitcoin-puppets"
          },
          {
            "in": "query",
            "name": "categoryAttributes",
            "required": false,
            "schema": {
              "type": "boolean",
              "default": false
            },
            "description": "Include category attributes for this collection in the response",
            "example": true
          }
        ],
        "responses": {
          "200": {
            "description": "Collection data retrieved successfully",
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
                        "collection": {
                          "type": "array",
                          "description": "Array containing collection data",
                          "items": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string",
                                "description": "Collection ID",
                                "example": "bitcoin-punks"
                              },
                              "name": {
                                "type": "string",
                                "description": "Collection name",
                                "example": "Bitcoin Punks"
                              },
                              "description": {
                                "type": "string",
                                "description": "Collection description",
                                "example": "A collection of unique Bitcoin Punks"
                              },
                              "inscription_min": {
                                "type": "number",
                                "description": "Minimum inscription number in the collection",
                                "example": 10000
                              },
                              "inscription_max": {
                                "type": "number",
                                "description": "Maximum inscription number in the collection",
                                "example": 100000
                              },
                              "total_items": {
                                "type": "number",
                                "description": "Total number of items in the collection",
                                "example": 10000
                              },
                              "image_url": {
                                "type": "string",
                                "description": "Collection image URI",
                                "example": "https://example.com/collection-image.png"
                              },
                              "image_url_content_type": {
                                "type": "string",
                                "description": "Content type of the collection image",
                                "example": "image/png"
                              },
                              "external_url": {
                                "type": "string",
                                "description": "e.g. Collection website URI",
                                "example": "https://bitcoinpunks.com"
                              },
                              "twitter_username": {
                                "type": "string",
                                "description": "Collection Twitter URI",
                                "example": "https://twitter.com/bitcoin_punks_"
                              },
                              "discord_url": {
                                "type": "string",
                                "description": "Collection Discord URI",
                                "example": "https://discord.gg/bitcoinpunks"
                              },
                              "creator_tips_address": {
                                "type": "string",
                                "description": "Creator tips address",
                                "example": "bc1qxyz1234567890abcdefg"
                              },
                              "creator_fees_enabled": {
                                "type": "boolean",
                                "description": "Whether creator fees are enabled for the collection",
                                "example": true
                              },
                              "category_attributes": {
                                "type": "array",
                                "description": "Array of category attributes for the collection",
                                "items": {
                                  "type": "object",
                                  "properties": {
                                    "key": {
                                      "type": "string"
                                    },
                                    "values": {
                                      "type": "array",
                                      "description": "Array of attribute values",
                                      "items": {
                                        "type": "object",
                                        "properties": {
                                          "value": {
                                            "type": "string",
                                            "description": "Attribute value",
                                            "example": "Rare"
                                          },
                                          "count": {
                                            "type": "number",
                                            "description": "Count of this attribute value in the collection",
                                            "example": 100
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
                      "example": "collection_id parameter is required"
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
            "description": "Collection not found",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": {
                      "type": "string",
                      "example": "Collection not found"
                    },
                    "code": {
                      "type": "string",
                      "example": "NOT_FOUND"
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
}
```
<!--
Satflow docs — Cancel a bid or ask order
Source: https://docs.satflow.com/reference/post_cancel.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

---
updatedAt: 2026-05-05T20:39:32.000Z
---

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Cancel a bid or ask order

Cancels a bid or ask order with signature verification

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
    "/cancel": {
      "post": {
        "tags": [
          "Cancel listing"
        ],
        "summary": "Cancel a bid or ask order",
        "description": "Cancels a bid or ask order with signature verification",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "makerAddress",
                  "orderType",
                  "signature"
                ],
                "properties": {
                  "makerAddress": {
                    "type": "string",
                    "description": "Address of the order maker",
                    "example": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                  },
                  "orderType": {
                    "type": "string",
                    "enum": [
                      "ask",
                      "bid"
                    ],
                    "description": "Type of order to cancel",
                    "example": "bid"
                  },
                  "signature": {
                    "type": "string",
                    "description": "Signed challenge for verification",
                    "example": "H1234567890abcdef..."
                  },
                  "_id": {
                    "type": "string",
                    "description": "Single order ID to cancel",
                    "example": "507f1f77bcf86cd799439011"
                  },
                  "_ids": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Multiple order IDs to cancel",
                    "example": [
                      "507f1f77bcf86cd799439011",
                      "507f1f77bcf86cd799439012"
                    ]
                  },
                  "inscriptionId": {
                    "type": "string",
                    "description": "Inscription ID for the order",
                    "example": "abc123def456..."
                  },
                  "runesOutput": {
                    "type": "string",
                    "description": "Runes output for the order",
                    "example": "txid:vout"
                  },
                  "txid": {
                    "type": "string",
                    "description": "Transaction ID",
                    "example": "abc123def456..."
                  },
                  "vin": {
                    "type": "array",
                    "items": {
                      "type": "number"
                    },
                    "description": "Input indices",
                    "example": [
                      0,
                      1
                    ]
                  },
                  "spentLocations": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Spent locations",
                    "example": [
                      "txid:vout"
                    ]
                  },
                  "cause": {
                    "type": "string",
                    "description": "Reason for cancellation",
                    "example": "User requested cancellation"
                  },
                  "output": {
                    "type": "string",
                    "description": "Output reference",
                    "example": "txid:vout"
                  },
                  "multiple": {
                    "type": "boolean",
                    "description": "Whether to cancel multiple orders",
                    "default": false
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Order cancelled successfully",
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
                        "success": {
                          "type": "boolean",
                          "description": "Whether the cancellation was successful",
                          "example": true
                        },
                        "summary": {
                          "type": "object",
                          "properties": {
                            "id": {
                              "type": "string",
                              "description": "ID of the cancelled order"
                            },
                            "success": {
                              "type": "boolean",
                              "description": "Whether the specific order was cancelled"
                            }
                          }
                        },
                        "successCount": {
                          "type": "number",
                          "description": "Number of successfully cancelled orders",
                          "example": 1
                        },
                        "failedCount": {
                          "type": "number",
                          "description": "Number of failed cancellations",
                          "example": 0
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
          "403": {
            "description": "Invalid signature or unauthorized",
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
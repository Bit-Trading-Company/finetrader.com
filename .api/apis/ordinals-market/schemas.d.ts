declare const GetActivityBids: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly collectionSlug: {
                    readonly type: "string";
                    readonly description: "Filter by collection slug";
                    readonly examples: readonly ["bitcoin-puppets"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly group: {
                    readonly type: "string";
                    readonly enum: readonly ["collection", "time"];
                    readonly description: "Group results by collection or time";
                    readonly examples: readonly ["collection"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly active: {
                    readonly type: "boolean";
                    readonly default: true;
                    readonly description: "Filter for active items only";
                    readonly examples: readonly [true];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly page: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly default: 1;
                    readonly description: "Page number for pagination";
                    readonly examples: readonly [1];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly pageSize: {
                    readonly type: "integer";
                    readonly default: 100;
                    readonly description: "Number of items per page";
                    readonly examples: readonly [50];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly external: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly description: "Include external marketplace data";
                    readonly examples: readonly [false];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly timeRange: {
                    readonly type: "string";
                    readonly enum: readonly ["24h", "7d", "30d"];
                    readonly description: "Time range filter";
                    readonly examples: readonly ["24h"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly includeOnlyCollectionItems: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly description: "Include only items from collections";
                    readonly examples: readonly [false];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly sortBy: {
                    readonly type: "string";
                    readonly enum: readonly ["createdAt", "fillCompletedAt", "fillPendingAt", "price", "unitPrice"];
                    readonly description: "Field to sort by";
                    readonly examples: readonly ["createdAt"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly sortDirection: {
                    readonly type: "string";
                    readonly enum: readonly ["asc", "desc"];
                    readonly default: "desc";
                    readonly description: "Sort direction";
                    readonly examples: readonly ["desc"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
            };
            readonly required: readonly [];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly items: {
                            readonly type: "array";
                            readonly description: "Array of activity items";
                            readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly _id: {
                                        readonly type: "string";
                                        readonly description: "Activity item ID";
                                        readonly examples: readonly ["507f1f77bcf86cd799439011"];
                                    };
                                    readonly inscriptionId: {
                                        readonly type: "string";
                                        readonly description: "Inscription ID";
                                        readonly examples: readonly ["6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"];
                                    };
                                    readonly price: {
                                        readonly type: "number";
                                        readonly description: "Price in satoshis";
                                        readonly examples: readonly [1000000];
                                    };
                                    readonly timestamp: {
                                        readonly type: "string";
                                        readonly format: "date-time";
                                        readonly description: "Activity timestamp";
                                        readonly examples: readonly ["2023-12-01T10:00:00Z"];
                                    };
                                    readonly type: {
                                        readonly type: "string";
                                        readonly description: "Activity type";
                                        readonly examples: readonly ["sale"];
                                    };
                                    readonly collectionSlug: {
                                        readonly type: "string";
                                        readonly description: "Collection identifier";
                                        readonly examples: readonly ["bitcoin-puppets"];
                                    };
                                };
                            };
                        };
                        readonly pagination: {
                            readonly type: "object";
                            readonly properties: {
                                readonly page: {
                                    readonly type: "integer";
                                    readonly examples: readonly [1];
                                };
                                readonly pageSize: {
                                    readonly type: "integer";
                                    readonly examples: readonly [100];
                                };
                                readonly total: {
                                    readonly type: "integer";
                                    readonly examples: readonly [1500];
                                };
                                readonly totalPages: {
                                    readonly type: "integer";
                                    readonly examples: readonly [15];
                                };
                            };
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetActivityListings: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly collectionSlug: {
                    readonly type: "string";
                    readonly description: "Filter by collection slug";
                    readonly examples: readonly ["bitcoin-puppets"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly group: {
                    readonly type: "string";
                    readonly enum: readonly ["collection", "time"];
                    readonly description: "Group results by collection or time";
                    readonly examples: readonly ["collection"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly active: {
                    readonly type: "boolean";
                    readonly default: true;
                    readonly description: "Filter for active items only";
                    readonly examples: readonly [true];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly page: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly default: 1;
                    readonly description: "Page number for pagination";
                    readonly examples: readonly [1];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly pageSize: {
                    readonly type: "integer";
                    readonly default: 100;
                    readonly description: "Number of items per page";
                    readonly examples: readonly [50];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly external: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly description: "Include external marketplace data";
                    readonly examples: readonly [false];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly timeRange: {
                    readonly type: "string";
                    readonly enum: readonly ["24h", "7d", "30d"];
                    readonly description: "Time range filter";
                    readonly examples: readonly ["24h"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly includeOnlyCollectionItems: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly description: "Include only items from collections";
                    readonly examples: readonly [false];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly sortBy: {
                    readonly type: "string";
                    readonly enum: readonly ["createdAt", "fillCompletedAt", "fillPendingAt", "price", "unitPrice"];
                    readonly description: "Field to sort by";
                    readonly examples: readonly ["createdAt"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly sortDirection: {
                    readonly type: "string";
                    readonly enum: readonly ["asc", "desc"];
                    readonly default: "desc";
                    readonly description: "Sort direction";
                    readonly examples: readonly ["desc"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
            };
            readonly required: readonly [];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly items: {
                            readonly type: "array";
                            readonly description: "Array of activity items";
                            readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly _id: {
                                        readonly type: "string";
                                        readonly description: "Activity item ID";
                                        readonly examples: readonly ["507f1f77bcf86cd799439011"];
                                    };
                                    readonly inscriptionId: {
                                        readonly type: "string";
                                        readonly description: "Inscription ID";
                                        readonly examples: readonly ["6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"];
                                    };
                                    readonly price: {
                                        readonly type: "number";
                                        readonly description: "Price in satoshis";
                                        readonly examples: readonly [1000000];
                                    };
                                    readonly timestamp: {
                                        readonly type: "string";
                                        readonly format: "date-time";
                                        readonly description: "Activity timestamp";
                                        readonly examples: readonly ["2023-12-01T10:00:00Z"];
                                    };
                                    readonly type: {
                                        readonly type: "string";
                                        readonly description: "Activity type";
                                        readonly examples: readonly ["sale"];
                                    };
                                    readonly collectionSlug: {
                                        readonly type: "string";
                                        readonly description: "Collection identifier";
                                        readonly examples: readonly ["bitcoin-puppets"];
                                    };
                                };
                            };
                        };
                        readonly pagination: {
                            readonly type: "object";
                            readonly properties: {
                                readonly page: {
                                    readonly type: "integer";
                                    readonly examples: readonly [1];
                                };
                                readonly pageSize: {
                                    readonly type: "integer";
                                    readonly examples: readonly [100];
                                };
                                readonly total: {
                                    readonly type: "integer";
                                    readonly examples: readonly [1500];
                                };
                                readonly totalPages: {
                                    readonly type: "integer";
                                    readonly examples: readonly [15];
                                };
                            };
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetActivitySales: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly collectionSlug: {
                    readonly type: "string";
                    readonly description: "Filter by collection slug";
                    readonly examples: readonly ["bitcoin-puppets"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly group: {
                    readonly type: "string";
                    readonly enum: readonly ["collection", "time"];
                    readonly description: "Group results by collection or time";
                    readonly examples: readonly ["collection"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly active: {
                    readonly type: "boolean";
                    readonly default: true;
                    readonly description: "Filter for active items only";
                    readonly examples: readonly [true];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly page: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly default: 1;
                    readonly description: "Page number for pagination";
                    readonly examples: readonly [1];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly pageSize: {
                    readonly type: "integer";
                    readonly default: 100;
                    readonly description: "Number of items per page";
                    readonly examples: readonly [50];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly external: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly description: "Include external marketplace data";
                    readonly examples: readonly [false];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly timeRange: {
                    readonly type: "string";
                    readonly enum: readonly ["24h", "7d", "30d"];
                    readonly description: "Time range filter";
                    readonly examples: readonly ["24h"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly includeOnlyCollectionItems: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly description: "Include only items from collections";
                    readonly examples: readonly [false];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly sortBy: {
                    readonly type: "string";
                    readonly enum: readonly ["createdAt", "fillCompletedAt", "fillPendingAt", "price", "unitPrice"];
                    readonly description: "Field to sort by";
                    readonly examples: readonly ["createdAt"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
                readonly sortDirection: {
                    readonly type: "string";
                    readonly enum: readonly ["asc", "desc"];
                    readonly default: "desc";
                    readonly description: "Sort direction";
                    readonly examples: readonly ["desc"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                };
            };
            readonly required: readonly [];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly items: {
                            readonly type: "array";
                            readonly description: "Array of activity items";
                            readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly _id: {
                                        readonly type: "string";
                                        readonly description: "Activity item ID";
                                        readonly examples: readonly ["507f1f77bcf86cd799439011"];
                                    };
                                    readonly inscriptionId: {
                                        readonly type: "string";
                                        readonly description: "Inscription ID";
                                        readonly examples: readonly ["6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"];
                                    };
                                    readonly price: {
                                        readonly type: "number";
                                        readonly description: "Price in satoshis";
                                        readonly examples: readonly [1000000];
                                    };
                                    readonly timestamp: {
                                        readonly type: "string";
                                        readonly format: "date-time";
                                        readonly description: "Activity timestamp";
                                        readonly examples: readonly ["2023-12-01T10:00:00Z"];
                                    };
                                    readonly type: {
                                        readonly type: "string";
                                        readonly description: "Activity type";
                                        readonly examples: readonly ["sale"];
                                    };
                                    readonly collectionSlug: {
                                        readonly type: "string";
                                        readonly description: "Collection identifier";
                                        readonly examples: readonly ["bitcoin-puppets"];
                                    };
                                };
                            };
                        };
                        readonly pagination: {
                            readonly type: "object";
                            readonly properties: {
                                readonly page: {
                                    readonly type: "integer";
                                    readonly examples: readonly [1];
                                };
                                readonly pageSize: {
                                    readonly type: "integer";
                                    readonly examples: readonly [100];
                                };
                                readonly total: {
                                    readonly type: "integer";
                                    readonly examples: readonly [1500];
                                };
                                readonly totalPages: {
                                    readonly type: "integer";
                                    readonly examples: readonly [15];
                                };
                            };
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetAddressBiddingWallet: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly ordinalsAddress: {
                    readonly type: "string";
                    readonly examples: readonly ["bc1p..."];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "The ordinals address";
                };
                readonly paymentAddress: {
                    readonly type: "string";
                    readonly examples: readonly ["bc1q..."];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "The payment address";
                };
                readonly paymentPubkey: {
                    readonly type: "string";
                    readonly examples: readonly ["02..."];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "The payment public key";
                };
            };
            readonly required: readonly ["ordinalsAddress", "paymentAddress", "paymentPubkey"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly address: {
                            readonly type: "string";
                            readonly description: "The multiSig wallet address";
                            readonly examples: readonly ["bc1p..."];
                        };
                        readonly userPaymentAddress: {
                            readonly type: "string";
                            readonly description: "The user's payment address for the bidding wallet";
                            readonly examples: readonly ["bc1q..."];
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "500": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetAddressBids: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly address: {
                    readonly type: "string";
                    readonly examples: readonly ["bc1p..."];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "The wallet address to get bids for";
                };
            };
            readonly required: readonly ["address"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "array";
                    readonly description: "Array of active bids";
                    readonly items: {
                        readonly type: "object";
                        readonly properties: {
                            readonly _id: {
                                readonly type: "string";
                                readonly description: "Bid ID";
                                readonly examples: readonly ["507f1f77bcf86cd799439011"];
                            };
                            readonly inscriptionId: {
                                readonly type: "string";
                                readonly description: "Inscription ID being bid on";
                                readonly examples: readonly ["6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"];
                            };
                            readonly price: {
                                readonly type: "number";
                                readonly description: "Bid price in satoshis";
                                readonly examples: readonly [1000000];
                            };
                            readonly bidderAddress: {
                                readonly type: "string";
                                readonly description: "Bidder's address";
                                readonly examples: readonly ["bc1p..."];
                            };
                            readonly bidderTokenReceiveAddress: {
                                readonly type: "string";
                                readonly description: "Address to receive the token if bid is accepted";
                                readonly examples: readonly ["bc1p..."];
                            };
                            readonly createdAt: {
                                readonly type: "string";
                                readonly format: "date-time";
                                readonly description: "When the bid was created";
                                readonly examples: readonly ["2023-12-01T10:00:00Z"];
                            };
                            readonly expiresAt: {
                                readonly type: "string";
                                readonly format: "date-time";
                                readonly description: "When the bid expires";
                                readonly examples: readonly ["2023-12-08T10:00:00Z"];
                            };
                            readonly status: {
                                readonly type: "string";
                                readonly description: "Current bid status";
                                readonly examples: readonly ["active"];
                            };
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "404": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetAddressWalletContents: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly address: {
                    readonly type: "string";
                    readonly examples: readonly ["bc1p..."];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "The wallet address to get contents for";
                };
                readonly itemType: {
                    readonly type: "string";
                    readonly enum: readonly ["inscription", "rune", "all"];
                    readonly examples: readonly ["all"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Filter by item type";
                };
                readonly collection: {
                    readonly type: "string";
                    readonly examples: readonly ["bitcoin-frogs"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Filter by collection slug";
                };
                readonly listedOnly: {
                    readonly type: "boolean";
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Only return listed items";
                };
                readonly bidsOnly: {
                    readonly type: "boolean";
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Only return items with bids";
                };
                readonly cursor: {
                    readonly type: "integer";
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Pagination cursor";
                };
                readonly limit: {
                    readonly type: "integer";
                    readonly examples: readonly [100];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Number of items to return (default 100)";
                };
            };
            readonly required: readonly ["address"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly results: {
                            readonly type: "object";
                            readonly properties: {
                                readonly ordinals: {
                                    readonly type: "array";
                                    readonly description: "Array of ordinal/inscription items";
                                    readonly items: {
                                        readonly type: "object";
                                        readonly properties: {
                                            readonly collection: {
                                                readonly type: "object";
                                                readonly description: "Collection information";
                                                readonly additionalProperties: true;
                                            };
                                            readonly token: {
                                                readonly type: "object";
                                                readonly description: "Token details";
                                                readonly properties: {
                                                    readonly name: {
                                                        readonly type: "string";
                                                    };
                                                    readonly inscription_id: {
                                                        readonly type: "string";
                                                    };
                                                    readonly inscription_number: {
                                                        readonly type: "integer";
                                                    };
                                                    readonly image_url: {
                                                        readonly type: "string";
                                                    };
                                                    readonly content_type: {
                                                        readonly type: "string";
                                                    };
                                                };
                                            };
                                            readonly listing: {
                                                readonly type: "object";
                                                readonly description: "Listing information if item is listed";
                                                readonly properties: {
                                                    readonly price: {
                                                        readonly type: "number";
                                                    };
                                                    readonly secureListing: {
                                                        readonly type: "boolean";
                                                    };
                                                };
                                            };
                                            readonly market: {
                                                readonly type: "object";
                                                readonly description: "Market data including bids and floor prices";
                                                readonly additionalProperties: true;
                                            };
                                        };
                                    };
                                };
                                readonly runes: {
                                    readonly type: "array";
                                    readonly description: "Array of rune items";
                                    readonly items: {
                                        readonly type: "object";
                                        readonly properties: {
                                            readonly collection: {
                                                readonly type: "object";
                                                readonly description: "Rune collection information";
                                                readonly additionalProperties: true;
                                            };
                                            readonly token: {
                                                readonly type: "object";
                                                readonly description: "Rune token details";
                                                readonly properties: {
                                                    readonly name: {
                                                        readonly type: "string";
                                                    };
                                                    readonly rune_utxo_id: {
                                                        readonly type: "string";
                                                    };
                                                    readonly rune_amount: {
                                                        readonly type: "string";
                                                    };
                                                    readonly rune_symbol: {
                                                        readonly type: "string";
                                                    };
                                                    readonly rune_amount_formatted: {
                                                        readonly type: "number";
                                                    };
                                                    readonly rune_divisibility: {
                                                        readonly type: "integer";
                                                    };
                                                    readonly output: {
                                                        readonly type: "string";
                                                    };
                                                };
                                            };
                                            readonly listing: {
                                                readonly type: "object";
                                                readonly description: "Listing information if rune is listed";
                                                readonly properties: {
                                                    readonly price: {
                                                        readonly type: "number";
                                                    };
                                                    readonly price_per_rune_sats: {
                                                        readonly type: "number";
                                                    };
                                                };
                                            };
                                            readonly market: {
                                                readonly type: "object";
                                                readonly description: "Market data for the rune";
                                                readonly additionalProperties: true;
                                            };
                                        };
                                    };
                                };
                            };
                        };
                        readonly pending_orders: {
                            readonly type: "array";
                            readonly description: "Array of pending orders";
                            readonly items: {
                                readonly type: "object";
                                readonly additionalProperties: true;
                            };
                        };
                        readonly nextCursor: {
                            readonly type: "integer";
                            readonly description: "Cursor for next page of results";
                            readonly examples: readonly [1];
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "500": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetAssetSettingsTypeTicker: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                    readonly enum: readonly ["ordinals", "runes", "brc20"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "The type of the asset.";
                };
                readonly ticker: {
                    readonly type: "string";
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "The ticker symbol of the asset.";
                };
            };
            readonly required: readonly ["type", "ticker"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly required: readonly ["id", "type", "createdAt", "updatedAt"];
            readonly properties: {
                readonly id: {
                    readonly type: "string";
                    readonly description: "Unique identifier for the asset settings";
                    readonly examples: readonly ["507f1f77bcf86cd799439011"];
                };
                readonly type: {
                    readonly type: "string";
                    readonly enum: readonly ["ordinals", "runes", "brc20"];
                    readonly description: "The type of the asset\n\n`ordinals` `runes` `brc20`";
                    readonly examples: readonly ["ordinals"];
                };
                readonly ticker: {
                    readonly type: "string";
                    readonly description: "The ticker symbol of the asset";
                    readonly examples: readonly ["PEPE"];
                };
                readonly washTrading: {
                    readonly type: "boolean";
                    readonly description: "Whether wash trading is enabled for this asset";
                    readonly default: false;
                    readonly examples: readonly [false];
                };
                readonly createdAt: {
                    readonly type: "string";
                    readonly format: "date-time";
                    readonly description: "When the asset settings were created";
                    readonly examples: readonly ["2023-01-01T00:00:00.000Z"];
                };
                readonly updatedAt: {
                    readonly type: "string";
                    readonly format: "date-time";
                    readonly description: "When the asset settings were last updated";
                    readonly examples: readonly ["2023-01-01T00:00:00.000Z"];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetChallenge: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly address: {
                    readonly type: "string";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Bitcoin wallet address";
                };
            };
            readonly required: readonly ["address"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly challenge: {
                            readonly type: "string";
                            readonly description: "Message to be signed by the wallet";
                            readonly examples: readonly ["Welcome to Satflow!\n\nThis request will not trigger a blockchain transaction or cost any gas fees, and is used to verify your wallet address.\n\n[abc123...]"];
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetChallengeVerify: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly address: {
                    readonly type: "string";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Bitcoin wallet address";
                };
                readonly signature: {
                    readonly type: "string";
                    readonly examples: readonly ["H1234567890abcdef..."];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Signed challenge message";
                };
            };
            readonly required: readonly ["address", "signature"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly validity: {
                            readonly type: "boolean";
                            readonly description: "Whether the signature is valid";
                            readonly examples: readonly [true];
                        };
                        readonly publicKey: {
                            readonly type: "string";
                            readonly description: "Public key extracted from signature";
                            readonly examples: readonly ["02abc123..."];
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetCollection: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly collection_id: {
                    readonly type: "string";
                    readonly examples: readonly ["bitcoin-puppets"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Collection identifier";
                };
                readonly categoryAttributes: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly examples: readonly [true];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Include category attributes for this collection in the response";
                };
            };
            readonly required: readonly ["collection_id"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly collection: {
                            readonly type: "array";
                            readonly description: "Array containing collection data";
                            readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly id: {
                                        readonly type: "string";
                                        readonly description: "Collection ID";
                                        readonly examples: readonly ["bitcoin-punks"];
                                    };
                                    readonly name: {
                                        readonly type: "string";
                                        readonly description: "Collection name";
                                        readonly examples: readonly ["Bitcoin Punks"];
                                    };
                                    readonly description: {
                                        readonly type: "string";
                                        readonly description: "Collection description";
                                        readonly examples: readonly ["A collection of unique Bitcoin Punks"];
                                    };
                                    readonly inscription_min: {
                                        readonly type: "number";
                                        readonly description: "Minimum inscription number in the collection";
                                        readonly examples: readonly [10000];
                                    };
                                    readonly inscription_max: {
                                        readonly type: "number";
                                        readonly description: "Maximum inscription number in the collection";
                                        readonly examples: readonly [100000];
                                    };
                                    readonly total_items: {
                                        readonly type: "number";
                                        readonly description: "Total number of items in the collection";
                                        readonly examples: readonly [10000];
                                    };
                                    readonly image_url: {
                                        readonly type: "string";
                                        readonly description: "Collection image URI";
                                        readonly examples: readonly ["https://example.com/collection-image.png"];
                                    };
                                    readonly image_url_content_type: {
                                        readonly type: "string";
                                        readonly description: "Content type of the collection image";
                                        readonly examples: readonly ["image/png"];
                                    };
                                    readonly external_url: {
                                        readonly type: "string";
                                        readonly description: "e.g. Collection website URI";
                                        readonly examples: readonly ["https://bitcoinpunks.com"];
                                    };
                                    readonly twitter_username: {
                                        readonly type: "string";
                                        readonly description: "Collection Twitter URI";
                                        readonly examples: readonly ["https://twitter.com/bitcoin_punks_"];
                                    };
                                    readonly discord_url: {
                                        readonly type: "string";
                                        readonly description: "Collection Discord URI";
                                        readonly examples: readonly ["https://discord.gg/bitcoinpunks"];
                                    };
                                    readonly creator_tips_address: {
                                        readonly type: "string";
                                        readonly description: "Creator tips address";
                                        readonly examples: readonly ["bc1qxyz1234567890abcdefg"];
                                    };
                                    readonly category_attributes: {
                                        readonly type: "array";
                                        readonly description: "Array of category attributes for the collection";
                                        readonly items: {
                                            readonly type: "object";
                                            readonly properties: {
                                                readonly key: {
                                                    readonly type: "string";
                                                };
                                                readonly values: {
                                                    readonly type: "array";
                                                    readonly description: "Array of attribute values";
                                                    readonly items: {
                                                        readonly type: "object";
                                                        readonly properties: {
                                                            readonly value: {
                                                                readonly type: "string";
                                                                readonly description: "Attribute value";
                                                                readonly examples: readonly ["Rare"];
                                                            };
                                                            readonly count: {
                                                                readonly type: "number";
                                                                readonly description: "Count of this attribute value in the collection";
                                                                readonly examples: readonly [100];
                                                            };
                                                        };
                                                    };
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["collection_id parameter is required"];
                };
                readonly code: {
                    readonly type: "string";
                    readonly examples: readonly ["BAD_REQUEST"];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "404": {
            readonly type: "object";
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["Collection not found"];
                };
                readonly code: {
                    readonly type: "string";
                    readonly examples: readonly ["NOT_FOUND"];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetCollectionStats: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly collectionId: {
                    readonly type: "string";
                    readonly examples: readonly ["bitcoin-puppets"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Collection identifier or slug";
                };
            };
            readonly required: readonly ["collectionId"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly floor: {
                            readonly type: "number";
                            readonly description: "Current floor price in satoshis";
                            readonly examples: readonly [4726300];
                        };
                        readonly listedCount: {
                            readonly type: "number";
                            readonly description: "Number of items currently listed";
                            readonly examples: readonly [102];
                        };
                        readonly metadata: {
                            readonly type: "object";
                            readonly properties: {
                                readonly inscription_range_start: {
                                    readonly type: "number";
                                    readonly description: "Starting inscription number for the collection";
                                    readonly examples: readonly [83522];
                                };
                                readonly inscription_range_end: {
                                    readonly type: "number";
                                    readonly description: "Ending inscription number for the collection";
                                    readonly examples: readonly [111319];
                                };
                                readonly supply: {
                                    readonly type: "number";
                                    readonly description: "Total supply of the collection";
                                    readonly examples: readonly [10000];
                                };
                            };
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "404": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetCollectionStatsFloors: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                    readonly enum: readonly ["ordinals", "runes"];
                    readonly examples: readonly ["ordinals"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Type of collections to get floors for";
                };
                readonly slugs: {
                    readonly type: "string";
                    readonly examples: readonly ["bitcoin-puppets,omb"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Comma-separated list of collection slugs";
                };
            };
            readonly required: readonly ["type", "slugs"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly properties: {
                            readonly slug: {
                                readonly type: "string";
                                readonly description: "Collection slug identifier";
                                readonly examples: readonly ["bitcoin-puppets"];
                            };
                            readonly floor: {
                                readonly type: "number";
                                readonly description: "Current floor price in satoshis";
                                readonly examples: readonly [4726300];
                            };
                            readonly listedCount: {
                                readonly type: "number";
                                readonly description: "Number of items currently listed";
                                readonly examples: readonly [102];
                            };
                            readonly ownerCount: {
                                readonly type: "number";
                                readonly description: "Number of owners of this collection";
                                readonly examples: readonly [256];
                            };
                            readonly oneDayChange: {
                                readonly type: "number";
                                readonly description: "Percentage change in floor price over the last 24 hours";
                                readonly examples: readonly [2.5];
                            };
                            readonly sevenDayChange: {
                                readonly type: "number";
                                readonly description: "Percentage change in floor price over the last 7 days";
                                readonly examples: readonly [-1.2];
                            };
                            readonly timestamp: {
                                readonly type: "string";
                                readonly description: "Time of the floor price data point";
                                readonly examples: readonly ["2023-10-01T12:00:00Z"];
                            };
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["Type and slugs parameters are required"];
                };
                readonly code: {
                    readonly type: "string";
                    readonly examples: readonly ["BAD_REQUEST"];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "404": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetItem: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly inscriptionId: {
                    readonly type: "string";
                    readonly examples: readonly ["6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Ordinal inscription id";
                };
                readonly inscriptionNumber: {
                    readonly type: "integer";
                    readonly examples: readonly ["12345"];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Ordinal inscription number";
                };
                readonly metadata: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly examples: readonly [true];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Include metadata for this item in the response";
                };
                readonly bid: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly examples: readonly [true];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Include bid information for this item in the response";
                };
                readonly listing: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly examples: readonly [true];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Include listing information for this item in the response";
                };
                readonly exclude_ord: {
                    readonly type: "boolean";
                    readonly default: false;
                    readonly examples: readonly [true];
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "Exclude ordinals data from the response";
                };
            };
            readonly required: readonly [];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly id: {
                            readonly type: "string";
                            readonly description: "Inscription ID";
                            readonly examples: readonly ["6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"];
                        };
                        readonly inscriptionNumber: {
                            readonly type: "string";
                            readonly description: "Inscription number";
                            readonly examples: readonly ["12345"];
                        };
                        readonly contentType: {
                            readonly type: "string";
                            readonly description: "Content type of the inscription";
                            readonly examples: readonly ["image/png"];
                        };
                        readonly contentURI: {
                            readonly type: "string";
                            readonly description: "URI to access the inscription content";
                            readonly examples: readonly ["https://ord.satflow.com/content/6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"];
                        };
                        readonly contentPreviewURI: {
                            readonly type: "string";
                            readonly description: "URI to access the inscription preview";
                            readonly examples: readonly ["https://ord.satflow.com/preview/6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"];
                        };
                        readonly genesisTransaction: {
                            readonly type: "string";
                            readonly description: "Genesis transaction ID";
                            readonly examples: readonly ["6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799"];
                        };
                        readonly owner: {
                            readonly type: "string";
                            readonly description: "Current owner address";
                            readonly examples: readonly ["bc1p..."];
                        };
                        readonly location: {
                            readonly type: "string";
                            readonly description: "Current location of the inscription";
                            readonly examples: readonly ["6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799:0:0"];
                        };
                        readonly output: {
                            readonly type: "string";
                            readonly description: "Output reference";
                            readonly examples: readonly ["6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799:0"];
                        };
                        readonly outputValue: {
                            readonly type: "number";
                            readonly description: "Output value in satoshis";
                            readonly examples: readonly [546];
                        };
                        readonly listed: {
                            readonly type: "boolean";
                            readonly description: "Whether the inscription is currently listed (only included if listing=true)";
                            readonly examples: readonly [true];
                        };
                        readonly listing: {
                            readonly type: "object";
                            readonly description: "Listing data (only included if listing=true and item is listed)";
                            readonly properties: {
                                readonly price: {
                                    readonly type: "number";
                                    readonly description: "Listing price in satoshis";
                                    readonly examples: readonly [1000000];
                                };
                                readonly sellerAddress: {
                                    readonly type: "string";
                                    readonly description: "Seller's ordinal address";
                                    readonly examples: readonly ["bc1p..."];
                                };
                            };
                        };
                        readonly hasBid: {
                            readonly type: "boolean";
                            readonly description: "Whether the inscription has bids (only included if bid=true)";
                            readonly examples: readonly [true];
                        };
                        readonly topBid: {
                            readonly type: "object";
                            readonly description: "Top bid data (only included if bid=true and item has bids)";
                            readonly properties: {
                                readonly price: {
                                    readonly type: "number";
                                    readonly description: "Bid price in satoshis";
                                    readonly examples: readonly [800000];
                                };
                                readonly bidderAddress: {
                                    readonly type: "string";
                                    readonly description: "Bidder's address";
                                    readonly examples: readonly ["bc1q..."];
                                };
                            };
                        };
                        readonly bids: {
                            readonly type: "array";
                            readonly description: "Array of all bids (only included if bid=true)";
                            readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly price: {
                                        readonly type: "number";
                                        readonly description: "Bid price in satoshis";
                                        readonly examples: readonly [800000];
                                    };
                                    readonly bidderAddress: {
                                        readonly type: "string";
                                        readonly description: "Bidder's address";
                                        readonly examples: readonly ["bc1q..."];
                                    };
                                };
                            };
                        };
                        readonly metadata: {
                            readonly type: "object";
                            readonly description: "Token and collection metadata (only included if metadata=true)";
                            readonly properties: {
                                readonly token: {
                                    readonly type: "object";
                                    readonly description: "Token metadata";
                                    readonly additionalProperties: true;
                                };
                                readonly collection: {
                                    readonly type: "object";
                                    readonly description: "Collection metadata";
                                    readonly additionalProperties: true;
                                };
                            };
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "404": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const GetOrdersFloor: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly collectionIds: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                    readonly $schema: "http://json-schema.org/draft-04/schema#";
                    readonly description: "An array of collection IDs to fetch floor listings for.";
                };
            };
            readonly required: readonly ["collectionIds"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly collection: {
                        readonly type: "string";
                        readonly description: "The collection ID.";
                    };
                    readonly floor: {
                        readonly type: "object";
                        readonly description: "The floor listing details.";
                        readonly additionalProperties: true;
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "500": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostBidFill: {
    readonly body: {
        readonly oneOf: readonly [{
            readonly type: "object";
            readonly title: "Inscription Bid";
            readonly required: readonly ["price", "inscriptionId", "sellerOrdAddress", "sellerReceiveAddress", "sellerPublicKey", "signedAcceptedBidPSBT"];
            readonly properties: {
                readonly price: {
                    readonly type: "number";
                    readonly description: "Bid price in satoshis";
                    readonly examples: readonly [100000];
                };
                readonly inscriptionId: {
                    readonly type: "string";
                    readonly description: "Inscription ID for the bid";
                    readonly examples: readonly ["abc123def456..."];
                };
                readonly sellerOrdAddress: {
                    readonly type: "string";
                    readonly description: "Seller's ordinal address";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                };
                readonly sellerReceiveAddress: {
                    readonly type: "string";
                    readonly description: "Address to receive payment";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                };
                readonly sellerPublicKey: {
                    readonly type: "string";
                    readonly description: "Seller's public key";
                    readonly examples: readonly ["abc123def456..."];
                };
                readonly signedAcceptedBidPSBT: {
                    readonly type: "string";
                    readonly description: "Signed accept bid PSBT in base64 format";
                    readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
                };
                readonly unsignedAcceptBidPSBT: {
                    readonly type: "string";
                    readonly description: "Unsigned accept bid PSBT in base64 format (optional)";
                    readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
                };
                readonly referralAddress: {
                    readonly type: "string";
                    readonly description: "Referral address for commission (optional)";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                };
                readonly skipBroadcast: {
                    readonly type: "boolean";
                    readonly description: "Whether to skip broadcasting the transaction";
                    readonly default: false;
                };
            };
        }, {
            readonly type: "object";
            readonly title: "Collection Bid";
            readonly required: readonly ["metaType", "bids", "signedAcceptCollectionBidPSBT", "unsignedAcceptCollectionBidPSBT"];
            readonly properties: {
                readonly metaType: {
                    readonly type: "string";
                    readonly enum: readonly ["runes", "ordinals"];
                    readonly description: "Type of assets being traded";
                    readonly examples: readonly ["ordinals"];
                };
                readonly bids: {
                    readonly type: "array";
                    readonly description: "Array of collection bids to fill";
                    readonly items: {
                        readonly type: "object";
                        readonly required: readonly ["_id", "seller", "bidder"];
                        readonly properties: {
                            readonly _id: {
                                readonly type: "string";
                                readonly description: "Bid ID";
                            };
                            readonly seller: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly collectionSlug: {
                                        readonly type: "string";
                                    };
                                    readonly sellerOrdAddress: {
                                        readonly type: "string";
                                    };
                                    readonly sellerPaymentAddress: {
                                        readonly type: "string";
                                    };
                                    readonly sellerPaymentAddressPublicKey: {
                                        readonly type: "string";
                                    };
                                    readonly sellerOrdinalsAddressPublicKey: {
                                        readonly type: "string";
                                    };
                                    readonly inscriptionIds: {
                                        readonly type: "array";
                                        readonly items: {
                                            readonly type: "string";
                                        };
                                    };
                                    readonly runeOutputs: {
                                        readonly type: "array";
                                        readonly items: {
                                            readonly type: "string";
                                        };
                                    };
                                    readonly fillQuantity: {
                                        readonly type: "number";
                                    };
                                };
                            };
                            readonly bidder: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly collectionSlug: {
                                        readonly type: "string";
                                    };
                                    readonly bidderAddress: {
                                        readonly type: "string";
                                    };
                                    readonly bidderTokenReceiveAddress: {
                                        readonly type: "string";
                                    };
                                    readonly unitPrice: {
                                        readonly type: "number";
                                    };
                                    readonly quantity: {
                                        readonly type: "number";
                                    };
                                };
                            };
                        };
                    };
                };
                readonly feeInfo: {
                    readonly description: "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                    readonly oneOf: readonly [{
                        readonly type: "string";
                        readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                    }, {
                        readonly type: "number";
                        readonly minimum: 0.01;
                    }];
                    readonly default: "fastestFee";
                    readonly examples: readonly ["fastestFee"];
                };
                readonly signedAcceptCollectionBidPSBT: {
                    readonly type: "string";
                    readonly description: "Signed accept collection bid PSBT in base64 format";
                    readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
                };
                readonly unsignedAcceptCollectionBidPSBT: {
                    readonly type: "string";
                    readonly description: "Unsigned accept collection bid PSBT in base64 format";
                    readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
                };
                readonly referralAddress: {
                    readonly type: "string";
                    readonly description: "Referral address for commission (optional)";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                };
                readonly skipBroadcast: {
                    readonly type: "boolean";
                    readonly description: "Whether to skip broadcasting the transaction";
                    readonly default: false;
                };
            };
        }];
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly txid: {
                            readonly type: "string";
                            readonly description: "Transaction ID of the broadcast transaction";
                        };
                        readonly success: {
                            readonly type: "boolean";
                            readonly description: "Whether the bid was successfully filled";
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "500": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostBidPlace: {
    readonly body: {
        readonly oneOf: readonly [{
            readonly type: "object";
            readonly title: "Inscription Bid";
            readonly required: readonly ["price", "inscriptionId", "bidderAddress", "bidderTokenReceiveAddress", "signedBiddingPSBT"];
            readonly properties: {
                readonly price: {
                    readonly type: "number";
                    readonly description: "Bid price in satoshis";
                    readonly examples: readonly [100000];
                };
                readonly inscriptionId: {
                    readonly type: "string";
                    readonly description: "Inscription ID to bid on";
                    readonly examples: readonly ["abc123def456..."];
                };
                readonly bidderAddress: {
                    readonly type: "string";
                    readonly description: "Bidder's payment address";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                };
                readonly bidderTokenReceiveAddress: {
                    readonly type: "string";
                    readonly description: "Address to receive the token if bid is accepted";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                };
                readonly signedBiddingPSBT: {
                    readonly type: "string";
                    readonly description: "Signed bidding PSBT in base64 format";
                    readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
                };
                readonly unsignedBiddingPSBT: {
                    readonly type: "string";
                    readonly description: "Unsigned bidding PSBT in base64 format (optional)";
                    readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
                };
                readonly feeRate: {
                    readonly description: "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                    readonly oneOf: readonly [{
                        readonly type: "string";
                        readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                    }, {
                        readonly type: "number";
                        readonly minimum: 0.01;
                    }];
                    readonly default: "fastestFee";
                    readonly examples: readonly ["fastestFee"];
                };
            };
        }, {
            readonly type: "object";
            readonly title: "Collection Bid";
            readonly required: readonly ["price", "collectionSlug", "bidderAddress", "bidderTokenReceiveAddress", "bidderAddressPublicKey", "quantity", "metaType", "signedBiddingMessage", "timestamp", "bidExpiry"];
            readonly properties: {
                readonly price: {
                    readonly type: "number";
                    readonly description: "Unit bid price in satoshis";
                    readonly examples: readonly [100000];
                };
                readonly collectionSlug: {
                    readonly type: "string";
                    readonly description: "Collection slug to bid on";
                    readonly examples: readonly ["bitcoin-puppets"];
                };
                readonly bidderAddress: {
                    readonly type: "string";
                    readonly description: "Bidder's payment address";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                };
                readonly bidderTokenReceiveAddress: {
                    readonly type: "string";
                    readonly description: "Address to receive the tokens if bid is accepted";
                    readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                };
                readonly bidderAddressPublicKey: {
                    readonly type: "string";
                    readonly description: "Bidder's public key";
                    readonly examples: readonly ["02abc123def456..."];
                };
                readonly quantity: {
                    readonly type: "number";
                    readonly description: "Quantity of items to bid on";
                    readonly examples: readonly [5];
                };
                readonly metaType: {
                    readonly type: "string";
                    readonly enum: readonly ["runes", "ordinals"];
                    readonly description: "Type of assets being bid on";
                    readonly examples: readonly ["ordinals"];
                };
                readonly signedBiddingMessage: {
                    readonly type: "string";
                    readonly description: "Signed bidding message for verification";
                    readonly examples: readonly ["H1234567890abcdef..."];
                };
                readonly timestamp: {
                    readonly type: "number";
                    readonly description: "Timestamp when the bid was created";
                    readonly examples: readonly [1640995200000];
                };
                readonly bidExpiry: {
                    readonly type: "number";
                    readonly description: "Timestamp when the bid expires";
                    readonly examples: readonly [1641081600000];
                };
                readonly feeRate: {
                    readonly description: "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                    readonly oneOf: readonly [{
                        readonly type: "string";
                        readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                    }, {
                        readonly type: "number";
                        readonly minimum: 0.01;
                    }];
                    readonly default: "fastestFee";
                    readonly examples: readonly ["fastestFee"];
                };
                readonly skipBroadcast: {
                    readonly type: "boolean";
                    readonly description: "Whether to skip broadcasting the transaction";
                    readonly default: false;
                };
            };
        }];
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly message: {
                            readonly type: "string";
                            readonly description: "Success message";
                            readonly examples: readonly ["Successfully bid!"];
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "500": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostCancel: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["makerAddress", "orderType", "signature"];
        readonly properties: {
            readonly makerAddress: {
                readonly type: "string";
                readonly description: "Address of the order maker";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly orderType: {
                readonly type: "string";
                readonly enum: readonly ["ask", "bid"];
                readonly description: "Type of order to cancel";
                readonly examples: readonly ["bid"];
            };
            readonly signature: {
                readonly type: "string";
                readonly description: "Signed challenge for verification";
                readonly examples: readonly ["H1234567890abcdef..."];
            };
            readonly _id: {
                readonly type: "string";
                readonly description: "Single order ID to cancel";
                readonly examples: readonly ["507f1f77bcf86cd799439011"];
            };
            readonly _ids: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Multiple order IDs to cancel";
                readonly examples: readonly ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"];
            };
            readonly inscriptionId: {
                readonly type: "string";
                readonly description: "Inscription ID for the order";
                readonly examples: readonly ["abc123def456..."];
            };
            readonly runesOutput: {
                readonly type: "string";
                readonly description: "Runes output for the order";
                readonly examples: readonly ["txid:vout"];
            };
            readonly txid: {
                readonly type: "string";
                readonly description: "Transaction ID";
                readonly examples: readonly ["abc123def456..."];
            };
            readonly vin: {
                readonly type: "array";
                readonly items: {
                    readonly type: "number";
                };
                readonly description: "Input indices";
                readonly examples: readonly [0, 1];
            };
            readonly spentLocations: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Spent locations";
                readonly examples: readonly ["txid:vout"];
            };
            readonly cause: {
                readonly type: "string";
                readonly description: "Reason for cancellation";
                readonly examples: readonly ["User requested cancellation"];
            };
            readonly output: {
                readonly type: "string";
                readonly description: "Output reference";
                readonly examples: readonly ["txid:vout"];
            };
            readonly multiple: {
                readonly type: "boolean";
                readonly description: "Whether to cancel multiple orders";
                readonly default: false;
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly success: {
                            readonly type: "boolean";
                            readonly description: "Whether the cancellation was successful";
                            readonly examples: readonly [true];
                        };
                        readonly summary: {
                            readonly type: "object";
                            readonly properties: {
                                readonly id: {
                                    readonly type: "string";
                                    readonly description: "ID of the cancelled order";
                                };
                                readonly success: {
                                    readonly type: "boolean";
                                    readonly description: "Whether the specific order was cancelled";
                                };
                            };
                        };
                        readonly successCount: {
                            readonly type: "number";
                            readonly description: "Number of successfully cancelled orders";
                            readonly examples: readonly [1];
                        };
                        readonly failedCount: {
                            readonly type: "number";
                            readonly description: "Number of failed cancellations";
                            readonly examples: readonly [0];
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "403": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostIntentAccept: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["inscriptionId"];
        readonly properties: {
            readonly inscriptionId: {
                readonly type: "string";
                readonly description: "Inscription ID for the bid to accept";
                readonly examples: readonly ["abc123def456..."];
            };
            readonly sellerTapInternalKey: {
                readonly type: "string";
                readonly description: "Seller's taproot internal key (optional)";
                readonly examples: readonly ["abc123def456..."];
            };
            readonly referralAddress: {
                readonly type: "string";
                readonly description: "Referral address for commission (optional)";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
};
declare const PostIntentAcceptCollectionBid: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["metaType", "bids"];
        readonly properties: {
            readonly metaType: {
                readonly type: "string";
                readonly enum: readonly ["runes", "ordinals"];
                readonly description: "Type of assets being traded";
                readonly examples: readonly ["ordinals"];
            };
            readonly bids: {
                readonly type: "array";
                readonly description: "Array of collection bids to accept";
                readonly items: {
                    readonly type: "object";
                    readonly required: readonly ["_id", "seller", "bidder"];
                    readonly properties: {
                        readonly _id: {
                            readonly type: "string";
                            readonly description: "Bid ID";
                        };
                        readonly seller: {
                            readonly type: "object";
                            readonly properties: {
                                readonly collectionSlug: {
                                    readonly type: "string";
                                };
                                readonly sellerOrdAddress: {
                                    readonly type: "string";
                                };
                                readonly sellerPaymentAddress: {
                                    readonly type: "string";
                                };
                                readonly sellerPaymentAddressPublicKey: {
                                    readonly type: "string";
                                };
                                readonly sellerOrdinalsAddressPublicKey: {
                                    readonly type: "string";
                                };
                                readonly inscriptionIds: {
                                    readonly type: "array";
                                    readonly items: {
                                        readonly type: "string";
                                    };
                                };
                                readonly runeOutputs: {
                                    readonly type: "array";
                                    readonly items: {
                                        readonly type: "string";
                                    };
                                };
                                readonly fillQuantity: {
                                    readonly type: "number";
                                };
                            };
                        };
                        readonly bidder: {
                            readonly type: "object";
                            readonly properties: {
                                readonly collectionSlug: {
                                    readonly type: "string";
                                };
                                readonly bidderAddress: {
                                    readonly type: "string";
                                };
                                readonly bidderTokenReceiveAddress: {
                                    readonly type: "string";
                                };
                                readonly unitPrice: {
                                    readonly type: "number";
                                };
                                readonly quantity: {
                                    readonly type: "number";
                                };
                            };
                        };
                    };
                };
            };
            readonly feeInfo: {
                readonly description: "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                readonly oneOf: readonly [{
                    readonly type: "string";
                    readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                }, {
                    readonly type: "number";
                    readonly minimum: 0.01;
                }];
                readonly default: "fastestFee";
                readonly examples: readonly ["fastestFee"];
            };
            readonly referralAddress: {
                readonly type: "string";
                readonly description: "Referral address for commission (optional)";
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
};
declare const PostIntentBulkSell: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["listings"];
        readonly properties: {
            readonly listings: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly required: readonly ["price", "sellerOrdAddress", "sellerReceiveAddress"];
                    readonly properties: {
                        readonly price: {
                            readonly type: "number";
                            readonly description: "Listing price in satoshis";
                        };
                        readonly inscriptionId: {
                            readonly type: "string";
                            readonly description: "Inscription ID to list";
                        };
                        readonly runesOutput: {
                            readonly type: "string";
                            readonly description: "Runes output to list";
                        };
                        readonly sellerOrdAddress: {
                            readonly type: "string";
                            readonly description: "Seller's ordinal address";
                        };
                        readonly sellerReceiveAddress: {
                            readonly type: "string";
                            readonly description: "Address to receive payment";
                        };
                        readonly externalOrderId: {
                            readonly type: "string";
                            readonly description: "External order ID (optional)";
                        };
                        readonly tapInternalKey: {
                            readonly type: "string";
                            readonly description: "Taproot internal key (optional)";
                        };
                        readonly newLocation: {
                            readonly type: "string";
                            readonly description: "New location (optional)";
                        };
                        readonly runesData: {
                            readonly type: "object";
                            readonly description: "Runes data (optional)";
                            readonly additionalProperties: true;
                        };
                    };
                };
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
};
declare const PostIntentExternalPurchase: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["marketplace", "buyerAddress", "buyerPublicKey", "buyerTokenReceiveAddress", "buyerTokenReceivePublicKey"];
        readonly properties: {
            readonly marketplace: {
                readonly type: "string";
                readonly enum: readonly ["magiceden", "dotswap"];
                readonly description: "External marketplace name";
                readonly examples: readonly ["magiceden"];
            };
            readonly buyerAddress: {
                readonly type: "string";
                readonly description: "Buyer's Bitcoin address";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly buyerPublicKey: {
                readonly type: "string";
                readonly description: "Buyer's public key";
                readonly examples: readonly ["02abc123def456..."];
            };
            readonly buyerTokenReceiveAddress: {
                readonly type: "string";
                readonly description: "Address to receive purchased tokens";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly buyerTokenReceivePublicKey: {
                readonly type: "string";
                readonly description: "Public key for token receive address";
                readonly examples: readonly ["02def456ghi789..."];
            };
            readonly listings: {
                readonly type: "array";
                readonly description: "Array of listings to purchase (optional)";
                readonly items: {};
            };
            readonly feeRate: {
                readonly description: "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                readonly oneOf: readonly [{
                    readonly type: "string";
                    readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                }, {
                    readonly type: "number";
                    readonly minimum: 0.01;
                }];
                readonly examples: readonly ["fastestFee"];
            };
            readonly dotswapPayload: {
                readonly type: "object";
                readonly description: "Dotswap-specific payload (required for dotswap marketplace)";
                readonly additionalProperties: true;
            };
            readonly securePurchase: {
                readonly type: "boolean";
                readonly description: "Whether to use secure purchase mode";
                readonly default: false;
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
};
declare const PostIntentExternalSell: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["listings", "sellerOrdAddress", "receiveAddress", "sellerPublicKey", "marketplace"];
        readonly properties: {
            readonly listings: {
                readonly type: "array";
                readonly minItems: 1;
                readonly description: "Array of listings to create for external marketplace";
                readonly items: {
                    readonly type: "object";
                    readonly required: readonly ["price"];
                    readonly properties: {
                        readonly price: {
                            readonly type: "number";
                            readonly description: "Listing price in satoshis (must be positive)";
                            readonly examples: readonly [100000];
                        };
                        readonly tokenId: {
                            readonly type: "string";
                            readonly description: "Token ID (inscription ID) to list (optional)";
                            readonly examples: readonly ["abc123def456..."];
                        };
                        readonly runesOutput: {
                            readonly type: "string";
                            readonly description: "Runes output to list (optional)";
                            readonly examples: readonly ["txid:vout"];
                        };
                    };
                };
            };
            readonly sellerOrdAddress: {
                readonly type: "string";
                readonly description: "Seller's ordinal address";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly receiveAddress: {
                readonly type: "string";
                readonly description: "Address to receive payment";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly sellerPublicKey: {
                readonly type: "string";
                readonly description: "Seller's public key";
                readonly examples: readonly ["02abc123def456..."];
            };
            readonly marketplace: {
                readonly type: "string";
                readonly enum: readonly ["magiceden"];
                readonly description: "External marketplace name";
                readonly examples: readonly ["magiceden"];
            };
            readonly sessionId: {
                readonly type: "string";
                readonly description: "Session ID from previous requests (optional)";
                readonly examples: readonly ["session_abc123"];
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly description: "MagicEden listing intent response";
                    readonly properties: {
                        readonly success: {
                            readonly type: "boolean";
                            readonly examples: readonly [true];
                        };
                        readonly type: {
                            readonly type: "string";
                            readonly enum: readonly ["ordinals", "runes"];
                            readonly description: "Type of assets being listed\n\n`ordinals` `runes`";
                        };
                        readonly results: {
                            readonly type: "array";
                            readonly description: "Array of listing results";
                            readonly items: {
                                readonly type: "object";
                                readonly description: "Listing result (structure varies by type)";
                                readonly properties: {
                                    readonly unsignedCombinedPSBTBase64: {
                                        readonly type: "string";
                                        readonly description: "Unsigned combined PSBT in base64 format (ordinals only)";
                                    };
                                    readonly unsignedListingPSBTBase64: {
                                        readonly type: "string";
                                        readonly description: "Unsigned listing PSBT in base64 format (ordinals only)";
                                    };
                                    readonly tokenId: {
                                        readonly type: "string";
                                        readonly description: "Token/Inscription ID (ordinals only)";
                                    };
                                    readonly price: {
                                        readonly type: "number";
                                        readonly description: "Listing price in satoshis";
                                    };
                                    readonly sellerReceiveAddress: {
                                        readonly type: "string";
                                        readonly description: "Seller's receive address (ordinals only)";
                                    };
                                    readonly runeName: {
                                        readonly type: "string";
                                        readonly description: "Name of the rune (runes only)";
                                    };
                                    readonly orderPsbtBase64: {
                                        readonly type: "string";
                                        readonly description: "Order PSBT in base64 format (runes only)";
                                    };
                                    readonly unsignedRBFProtectedPsbts: {
                                        readonly type: "array";
                                        readonly items: {
                                            readonly type: "string";
                                        };
                                        readonly description: "Array of unsigned RBF-protected PSBTs (runes only)";
                                    };
                                    readonly makerReceiveAddress: {
                                        readonly type: "string";
                                        readonly description: "Maker's receive address (runes only)";
                                    };
                                    readonly makerRunesAddress: {
                                        readonly type: "string";
                                        readonly description: "Maker's runes address (runes only)";
                                    };
                                };
                            };
                        };
                        readonly messageToSign: {
                            readonly type: "string";
                            readonly description: "Message that needs to be signed using BIP-322 and included in the submit request";
                        };
                        readonly externalAuthToken: {
                            readonly type: "string";
                            readonly description: "A token which can be supplied in subsequent requests via X-External-Auth header to maintain authentication";
                        };
                        readonly externalAuthAddress: {
                            readonly type: "string";
                            readonly description: "The address which `externalAuthToken` is tied to, and which must sign the `messageToSign`";
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostIntentSatflowPurchase: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["buyerAddress", "buyerTokenReceiveAddress", "buyerPublicKey", "feeRate", "extractionFeeRate"];
        readonly properties: {
            readonly inscriptionIds: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Array of inscription IDs to purchase";
                readonly examples: readonly ["abc123def456...", "def456ghi789..."];
            };
            readonly runesOutputs: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Array of runes outputs to purchase";
                readonly examples: readonly ["txid:vout", "txid2:vout2"];
            };
            readonly buyerAddress: {
                readonly type: "string";
                readonly description: "Buyer's Bitcoin address";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly buyerTokenReceiveAddress: {
                readonly type: "string";
                readonly description: "Address to receive purchased tokens";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly buyerTokenReceivePublicKey: {
                readonly type: "string";
                readonly description: "Public key for token receive address";
                readonly examples: readonly ["02def456ghi789..."];
            };
            readonly buyerPublicKey: {
                readonly type: "string";
                readonly description: "Buyer's public key";
                readonly examples: readonly ["02abc123def456..."];
            };
            readonly feeRate: {
                readonly description: "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                readonly oneOf: readonly [{
                    readonly type: "string";
                    readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                }, {
                    readonly type: "number";
                    readonly minimum: 0.01;
                }];
                readonly examples: readonly ["fastestFee"];
            };
            readonly extractionFeeRate: {
                readonly description: "Extraction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                readonly oneOf: readonly [{
                    readonly type: "string";
                    readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                }, {
                    readonly type: "number";
                    readonly minimum: 0.01;
                }];
                readonly examples: readonly ["fastestFee"];
            };
            readonly minimalOutputs: {
                readonly type: "boolean";
                readonly description: "Use minimal outputs optimization";
            };
            readonly lightspeed: {
                readonly type: "boolean";
                readonly description: "Use lightspeed mode";
            };
            readonly splitQuantity: {
                readonly type: "number";
                readonly description: "Number of output splits (optional)";
                readonly examples: readonly [10];
            };
            readonly referralAddress: {
                readonly type: "string";
                readonly description: "Referral address for commission (optional)";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
};
declare const PostIntentSecurePurchase: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["buyerAddress", "buyerTokenReceiveAddress", "buyerPublicKey"];
        readonly properties: {
            readonly inscriptionIds: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Array of inscription IDs to purchase";
                readonly examples: readonly ["abc123def456...", "def456ghi789..."];
            };
            readonly runesOutputs: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Array of runes outputs to purchase";
                readonly examples: readonly ["txid:vout", "txid2:vout2"];
            };
            readonly buyerAddress: {
                readonly type: "string";
                readonly description: "Buyer's Bitcoin address";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly buyerTokenReceiveAddress: {
                readonly type: "string";
                readonly description: "Address to receive purchased tokens";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly buyerPublicKey: {
                readonly type: "string";
                readonly description: "Buyer's public key";
                readonly examples: readonly ["02abc123def456..."];
            };
            readonly feeRate: {
                readonly description: "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                readonly oneOf: readonly [{
                    readonly type: "string";
                    readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                }, {
                    readonly type: "number";
                    readonly minimum: 0.01;
                }];
                readonly examples: readonly ["fastestFee"];
            };
            readonly splitQuantity: {
                readonly type: "number";
                readonly description: "Number of output splits (optional)";
                readonly examples: readonly [10];
            };
            readonly signedPaymentPrepPSBT: {
                readonly type: "string";
                readonly description: "Signed payment preparation PSBT (optional)";
            };
            readonly signedPurchasePSBTs: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Array of signed purchase PSBTs (optional)";
            };
            readonly referralAddress: {
                readonly type: "string";
                readonly description: "Referral address for commission (optional)";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly description: "Secure purchase PSBT data";
                    readonly additionalProperties: true;
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostIntentSell: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["price", "sellerOrdAddress", "sellerReceiveAddress"];
        readonly properties: {
            readonly price: {
                readonly type: "number";
                readonly description: "Listing price in satoshis";
                readonly examples: readonly [100000];
            };
            readonly inscriptionId: {
                readonly type: "string";
                readonly description: "Inscription ID to list";
                readonly examples: readonly ["abc123def456..."];
            };
            readonly runesOutput: {
                readonly type: "string";
                readonly description: "Runes output to list";
                readonly examples: readonly ["txid:vout"];
            };
            readonly sellerOrdAddress: {
                readonly type: "string";
                readonly description: "Seller's ordinal address";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly sellerReceiveAddress: {
                readonly type: "string";
                readonly description: "Address to receive payment";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly externalOrderId: {
                readonly type: "string";
                readonly description: "External order ID (optional)";
            };
            readonly tapInternalKey: {
                readonly type: "string";
                readonly description: "Taproot internal key (optional)";
            };
            readonly newLocation: {
                readonly type: "string";
                readonly description: "New location (optional)";
            };
            readonly runesData: {
                readonly type: "object";
                readonly description: "Runes data (optional)";
                readonly additionalProperties: true;
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
};
declare const PostIntentWithdraw: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["userAddress", "amount"];
        readonly properties: {
            readonly userAddress: {
                readonly type: "string";
                readonly description: "User's Bitcoin address";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly amount: {
                readonly type: "number";
                readonly description: "Amount to withdraw in satoshis";
                readonly examples: readonly [100000];
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly unsignedPSBTBase64: {
                            readonly type: "string";
                            readonly description: "Unsigned PSBT in base64 format";
                        };
                        readonly unsignedPSBTHex: {
                            readonly type: "string";
                            readonly description: "Unsigned PSBT in hex format";
                        };
                        readonly paymentUtxoCount: {
                            readonly type: "number";
                            readonly description: "Number of payment UTXOs used";
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostList: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["listings", "signedListingPSBT", "signedSecureListingPSBTs"];
        readonly properties: {
            readonly listings: {
                readonly type: "array";
                readonly description: "Array of listing objects";
                readonly items: {
                    readonly type: "object";
                    readonly required: readonly ["price", "sellerOrdAddress", "sellerReceiveAddress"];
                    readonly properties: {
                        readonly price: {
                            readonly type: "number";
                            readonly description: "Listing price in satoshis";
                            readonly examples: readonly [100000];
                        };
                        readonly inscriptionId: {
                            readonly type: "string";
                            readonly description: "Inscription ID to list";
                            readonly examples: readonly ["abc123def456..."];
                        };
                        readonly runesOutput: {
                            readonly type: "string";
                            readonly description: "Runes output to list";
                            readonly examples: readonly ["txid:vout"];
                        };
                        readonly sellerOrdAddress: {
                            readonly type: "string";
                            readonly description: "Seller's ordinal address";
                            readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                        };
                        readonly sellerReceiveAddress: {
                            readonly type: "string";
                            readonly description: "Address to receive payment";
                            readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
                        };
                        readonly externalOrderId: {
                            readonly type: "string";
                            readonly description: "External order ID (optional)";
                        };
                        readonly tapInternalKey: {
                            readonly type: "string";
                            readonly description: "Taproot internal key (optional)";
                        };
                        readonly newLocation: {
                            readonly type: "string";
                            readonly description: "New location (optional)";
                        };
                        readonly runesData: {
                            readonly type: "object";
                            readonly description: "Runes data (optional)";
                            readonly additionalProperties: true;
                        };
                    };
                };
            };
            readonly signedListingPSBT: {
                readonly type: "string";
                readonly description: "Signed listing PSBT in base64 format";
                readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
            };
            readonly unsignedListingPSBT: {
                readonly type: "string";
                readonly description: "Unsigned listing PSBT in base64 format (optional)";
                readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
            };
            readonly signedSecureListingPSBTs: {
                readonly type: "array";
                readonly description: "Array of signed secure listing PSBTs";
                readonly items: {
                    readonly type: "string";
                    readonly description: "Signed secure listing PSBT in base64 format";
                    readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
                };
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly txid: {
                            readonly type: "string";
                            readonly description: "Transaction ID of the broadcast listing";
                        };
                        readonly listings: {
                            readonly type: "array";
                            readonly description: "Created listing objects";
                            readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly _id: {
                                        readonly type: "string";
                                        readonly description: "Listing ID";
                                    };
                                    readonly price: {
                                        readonly type: "number";
                                        readonly description: "Listing price";
                                    };
                                    readonly inscriptionId: {
                                        readonly type: "string";
                                        readonly description: "Inscription ID";
                                    };
                                    readonly status: {
                                        readonly type: "string";
                                        readonly description: "Listing status";
                                    };
                                };
                            };
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "500": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostListExternal: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["listings", "signedCombinedPSBT", "sellerPublicKey", "sellerOrdAddress", "receiveAddress", "type", "marketplace", "signedMessage", "unsignedMessage"];
        readonly properties: {
            readonly listings: {
                readonly oneOf: readonly [{
                    readonly type: "object";
                    readonly title: "Runes Listings";
                    readonly description: "Runes listings mapped by rune name. All properties from /intent/external-sell `results` array for this listing must be included.";
                    readonly additionalProperties: {
                        readonly type: "object";
                        readonly properties: {
                            readonly orderPsbtBase64: {
                                readonly type: "string";
                                readonly description: "Order PSBT in base64 format";
                            };
                            readonly signedRBFProtectedPsbts: {
                                readonly type: "array";
                                readonly items: {
                                    readonly type: "string";
                                };
                                readonly description: "Array of signed RBF-protected PSBTs";
                            };
                        };
                    };
                }, {
                    readonly type: "array";
                    readonly title: "Ordinals Listings";
                    readonly description: "Array of listings, taken from mpState and combined with signed PSBTs";
                    readonly minItems: 1;
                    readonly items: {
                        readonly type: "object";
                        readonly description: "Ordinal listing object with signed PSBTs. All properties from /intent/external-sell `results` array for this listing must be included.";
                        readonly properties: {
                            readonly inscriptionId: {
                                readonly type: "string";
                                readonly description: "Inscription ID being listed";
                            };
                            readonly price: {
                                readonly type: "number";
                                readonly description: "Listing price in satoshis";
                            };
                            readonly sellerReceiveAddress: {
                                readonly type: "string";
                                readonly description: "Seller's receive address";
                            };
                            readonly signedRBFProtectedListingPSBT: {
                                readonly type: "string";
                                readonly description: "Signed RBF-protected listing PSBT in base64 or hex format";
                            };
                            readonly signedRBFProtectedListingTransientPSBT: {
                                readonly type: "string";
                                readonly description: "Signed RBF-protected transient listing PSBT in base64 or hex format";
                            };
                        };
                    };
                }];
            };
            readonly signedCombinedPSBT: {
                readonly type: "string";
                readonly description: "Signed combined PSBT in base64 or hex format";
                readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
            };
            readonly sellerPublicKey: {
                readonly type: "string";
                readonly description: "Seller's public key";
                readonly examples: readonly ["02abc123def456..."];
            };
            readonly sellerOrdAddress: {
                readonly type: "string";
                readonly description: "Seller's ordinal address";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly receiveAddress: {
                readonly type: "string";
                readonly description: "Address to receive payment";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly type: {
                readonly type: "string";
                readonly enum: readonly ["runes", "ordinals"];
                readonly description: "Type of assets being listed";
                readonly examples: readonly ["ordinals"];
            };
            readonly marketplace: {
                readonly type: "string";
                readonly enum: readonly ["magiceden"];
                readonly description: "External marketplace name";
                readonly examples: readonly ["magiceden"];
            };
            readonly signedMessage: {
                readonly type: "string";
                readonly description: "Signed authentication message";
            };
            readonly unsignedMessage: {
                readonly type: "string";
                readonly description: "Unsigned authentication message";
            };
            readonly sessionId: {
                readonly type: "string";
                readonly description: "Session ID to maintain state across requests";
                readonly examples: readonly ["12345"];
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly description: "External listing submission response";
                    readonly properties: {
                        readonly success: {
                            readonly type: "boolean";
                            readonly examples: readonly [true];
                        };
                        readonly externalAuthToken: {
                            readonly type: "string";
                            readonly description: "External authentication token. Can be supplied as X-External-Auth header in future requests to prevent re-authentication";
                        };
                        readonly externalAuthAddress: {
                            readonly type: "string";
                            readonly description: "Address which `externalAuthToken` is tied to";
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "500": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostPurchaseBroadcast: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["buyerAddress", "buyerTokenReceiveAddress", "buyerTokenReceivePublicKey", "buyerPublicKey", "feeRate"];
        readonly properties: {
            readonly inscriptionIds: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Array of inscription IDs being purchased";
                readonly examples: readonly ["abc123def456...", "def456ghi789..."];
            };
            readonly runesOutputs: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Array of runes outputs being purchased";
                readonly examples: readonly ["txid:vout", "txid2:vout2"];
            };
            readonly signedBulkBuyingPSBT: {
                readonly type: "string";
                readonly description: "Signed bulk buying PSBT in base64 format";
                readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
            };
            readonly signedSecurePaymentPrepPSBT: {
                readonly type: "string";
                readonly description: "Signed secure payment preparation PSBT (for secure purchases)";
            };
            readonly signedSecurePurchasePSBTs: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
                readonly description: "Array of signed secure purchase PSBTs";
            };
            readonly signedSecureTransferPSBT: {
                readonly type: "string";
                readonly description: "Signed secure transfer PSBT";
            };
            readonly unsignedBulkBuyingPSBT: {
                readonly type: "string";
                readonly description: "Unsigned bulk buying PSBT in base64 format";
            };
            readonly unsignedExtractionPSBT: {
                readonly type: "string";
                readonly description: "Unsigned extraction PSBT in base64 format";
            };
            readonly signedExtractionPSBT: {
                readonly type: "string";
                readonly description: "Signed extraction PSBT in base64 format";
            };
            readonly securePurchase: {
                readonly type: "boolean";
                readonly description: "Whether this is a secure purchase";
                readonly default: false;
            };
            readonly buyerAddress: {
                readonly type: "string";
                readonly description: "Buyer's Bitcoin address";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly buyerTokenReceiveAddress: {
                readonly type: "string";
                readonly description: "Address to receive purchased tokens";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly buyerTokenReceivePublicKey: {
                readonly type: "string";
                readonly description: "Public key for token receive address";
                readonly examples: readonly ["02def456ghi789..."];
            };
            readonly buyerPublicKey: {
                readonly type: "string";
                readonly description: "Buyer's public key";
                readonly examples: readonly ["02abc123def456..."];
            };
            readonly feeRate: {
                readonly description: "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                readonly oneOf: readonly [{
                    readonly type: "string";
                    readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                }, {
                    readonly type: "number";
                    readonly minimum: 0.01;
                }];
                readonly examples: readonly ["fastestFee"];
            };
            readonly extractionFeeRate: {
                readonly description: "Extraction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                readonly oneOf: readonly [{
                    readonly type: "string";
                    readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                }, {
                    readonly type: "number";
                    readonly minimum: 0.01;
                }];
                readonly examples: readonly ["fastestFee"];
            };
            readonly minimalOutputs: {
                readonly type: "boolean";
                readonly description: "Use minimal outputs optimization";
            };
            readonly lightspeed: {
                readonly type: "boolean";
                readonly description: "Use lightspeed mode";
            };
            readonly isExtracted: {
                readonly type: "boolean";
                readonly description: "Whether tokens have been extracted";
            };
            readonly splitQuantity: {
                readonly type: "number";
                readonly description: "Number of output splits";
                readonly examples: readonly [10];
            };
            readonly referralAddress: {
                readonly type: "string";
                readonly description: "Referral address for commission";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly skipBroadcast: {
                readonly type: "boolean";
                readonly description: "Whether to skip broadcasting the transaction";
                readonly default: false;
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly fillTx: {
                            readonly type: "string";
                            readonly description: "Transaction ID of the broadcast purchase";
                        };
                        readonly unsignedExtractionPSBTBase64: {
                            readonly type: "string";
                            readonly description: "Unsigned extraction PSBT if extraction is needed";
                        };
                        readonly unsignedExtractionPSBTHex: {
                            readonly type: "string";
                            readonly description: "Unsigned extraction PSBT in hex format";
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "500": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostPurchaseExternal: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["buyerAddress", "buyerPublicKey", "buyerTokenReceiveAddress", "signedBuyingPSBT", "marketplace", "feeRate", "mpState"];
        readonly properties: {
            readonly listings: {
                readonly type: "array";
                readonly description: "Array of listings being purchased (optional)";
                readonly items: {};
            };
            readonly buyerAddress: {
                readonly type: "string";
                readonly description: "Buyer's Bitcoin address";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly buyerPublicKey: {
                readonly type: "string";
                readonly description: "Buyer's public key";
                readonly examples: readonly ["02abc123def456..."];
            };
            readonly buyerTokenReceiveAddress: {
                readonly type: "string";
                readonly description: "Address to receive purchased tokens";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly signedBuyingPSBT: {
                readonly type: "string";
                readonly description: "Signed buying PSBT in base64 format";
                readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
            };
            readonly marketplace: {
                readonly type: "string";
                readonly description: "External marketplace name";
                readonly examples: readonly ["magiceden"];
            };
            readonly feeRate: {
                readonly description: "Transaction fee rate option. Can be one of the predefined options (`fastestFee`, `halfHourFee`, `hourFee`, `minimumFee`) or a custom number sat/vB.\n";
                readonly oneOf: readonly [{
                    readonly type: "string";
                    readonly enum: readonly ["fastestFee", "halfHourFee", "hourFee", "minimumFee"];
                }, {
                    readonly type: "number";
                    readonly minimum: 0.01;
                }];
                readonly examples: readonly ["fastestFee"];
            };
            readonly securePurchase: {
                readonly type: "boolean";
                readonly description: "Whether this is a secure purchase";
                readonly default: false;
            };
            readonly mpState: {
                readonly type: "object";
                readonly description: "Marketplace state object containing transaction details (provided by the intent endpoint)";
                readonly additionalProperties: true;
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly fillTx: {
                            readonly type: "string";
                            readonly description: "Transaction ID of the submitted purchase";
                        };
                        readonly message: {
                            readonly type: "string";
                            readonly description: "Success message";
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "500": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
declare const PostWithdraw: {
    readonly body: {
        readonly type: "object";
        readonly required: readonly ["signedWithdrawPSBT"];
        readonly properties: {
            readonly signedWithdrawPSBT: {
                readonly type: "string";
                readonly description: "Signed withdraw PSBT in base64 or hex format";
                readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
            };
            readonly unsignedWithdrawPSBT: {
                readonly type: "string";
                readonly description: "Original unsigned PSBT for verification (optional)";
                readonly examples: readonly ["cHNidP8BAH0CAAAAAe..."];
            };
            readonly bidderPaymentAddress: {
                readonly type: "string";
                readonly description: "Bidder payment address (optional)";
                readonly examples: readonly ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"];
            };
            readonly skipBroadcast: {
                readonly type: "boolean";
                readonly description: "Skip broadcasting to network (for testing)";
                readonly default: false;
            };
        };
        readonly $schema: "http://json-schema.org/draft-04/schema#";
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly success: {
                    readonly type: "boolean";
                    readonly examples: readonly [true];
                };
                readonly data: {
                    readonly type: "object";
                    readonly properties: {
                        readonly txid: {
                            readonly type: "string";
                            readonly description: "Transaction ID of the broadcasted transaction";
                            readonly examples: readonly ["abc123def456..."];
                        };
                    };
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
        readonly "400": {
            readonly type: "object";
            readonly required: readonly ["error"];
            readonly properties: {
                readonly error: {
                    readonly type: "string";
                    readonly examples: readonly ["For error reasons, review the response data."];
                };
            };
            readonly $schema: "http://json-schema.org/draft-04/schema#";
        };
    };
};
export { GetActivityBids, GetActivityListings, GetActivitySales, GetAddressBiddingWallet, GetAddressBids, GetAddressWalletContents, GetAssetSettingsTypeTicker, GetChallenge, GetChallengeVerify, GetCollection, GetCollectionStats, GetCollectionStatsFloors, GetItem, GetOrdersFloor, PostBidFill, PostBidPlace, PostCancel, PostIntentAccept, PostIntentAcceptCollectionBid, PostIntentBulkSell, PostIntentExternalPurchase, PostIntentExternalSell, PostIntentSatflowPurchase, PostIntentSecurePurchase, PostIntentSell, PostIntentWithdraw, PostList, PostListExternal, PostPurchaseBroadcast, PostPurchaseExternal, PostWithdraw };

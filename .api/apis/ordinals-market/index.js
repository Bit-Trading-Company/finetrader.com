"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var oas_1 = __importDefault(require("oas"));
var core_1 = __importDefault(require("api/dist/core"));
var openapi_json_1 = __importDefault(require("./openapi.json"));
var SDK = /** @class */ (function () {
    function SDK() {
        this.spec = oas_1.default.init(openapi_json_1.default);
        this.core = new core_1.default(this.spec, 'ordinals-market/1.1.2-prod (api/6.1.3)');
    }
    /**
     * Optionally configure various options that the SDK allows.
     *
     * @param config Object of supported SDK options and toggles.
     * @param config.timeout Override the default `fetch` request timeout of 30 seconds. This number
     * should be represented in milliseconds.
     */
    SDK.prototype.config = function (config) {
        this.core.setConfig(config);
    };
    /**
     * If the API you're using requires authentication you can supply the required credentials
     * through this method and the library will magically determine how they should be used
     * within your API request.
     *
     * With the exception of OpenID and MutualTLS, it supports all forms of authentication
     * supported by the OpenAPI specification.
     *
     * @example <caption>HTTP Basic auth</caption>
     * sdk.auth('username', 'password');
     *
     * @example <caption>Bearer tokens (HTTP or OAuth 2)</caption>
     * sdk.auth('myBearerToken');
     *
     * @example <caption>API Keys</caption>
     * sdk.auth('myApiKey');
     *
     * @see {@link https://spec.openapis.org/oas/v3.0.3#fixed-fields-22}
     * @see {@link https://spec.openapis.org/oas/v3.1.0#fixed-fields-22}
     * @param values Your auth credentials for the API; can specify up to two strings or numbers.
     */
    SDK.prototype.auth = function () {
        var _a;
        var values = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            values[_i] = arguments[_i];
        }
        (_a = this.core).setAuth.apply(_a, values);
        return this;
    };
    /**
     * If the API you're using offers alternate server URLs, and server variables, you can tell
     * the SDK which one to use with this method. To use it you can supply either one of the
     * server URLs that are contained within the OpenAPI definition (along with any server
     * variables), or you can pass it a fully qualified URL to use (that may or may not exist
     * within the OpenAPI definition).
     *
     * @example <caption>Server URL with server variables</caption>
     * sdk.server('https://{region}.api.example.com/{basePath}', {
     *   name: 'eu',
     *   basePath: 'v14',
     * });
     *
     * @example <caption>Fully qualified server URL</caption>
     * sdk.server('https://eu.api.example.com/v14');
     *
     * @param url Server URL
     * @param variables An object of variables to replace into the server URL.
     */
    SDK.prototype.server = function (url, variables) {
        if (variables === void 0) { variables = {}; }
        this.core.setServer(url, variables);
    };
    /**
     * Returns bid activity data with optional filtering and pagination
     *
     * @summary Get bid activity data
     * @throws FetchError<400, types.GetActivityBidsResponse400> Invalid parameters
     */
    SDK.prototype.getActivityBids = function (metadata) {
        return this.core.fetch('/activity/bids', 'get', metadata);
    };
    /**
     * Returns sales activity data with optional filtering and pagination
     *
     * @summary Get sales activity data
     * @throws FetchError<400, types.GetActivitySalesResponse400> Invalid parameters
     */
    SDK.prototype.getActivitySales = function (metadata) {
        return this.core.fetch('/activity/sales', 'get', metadata);
    };
    /**
     * Returns listings activity data with optional filtering and pagination
     *
     * @summary Get listings activity data
     * @throws FetchError<400, types.GetActivityListingsResponse400> Invalid parameters
     */
    SDK.prototype.getActivityListings = function (metadata) {
        return this.core.fetch('/activity/listings', 'get', metadata);
    };
    /**
     * Returns an array of active bids placed by the specified address
     *
     * @summary Get active bids for an address
     * @throws FetchError<400, types.GetAddressBidsResponse400> Invalid parameters
     * @throws FetchError<404, types.GetAddressBidsResponse404> Address not found or no bids
     */
    SDK.prototype.getAddressBids = function (metadata) {
        return this.core.fetch('/address/bids', 'get', metadata);
    };
    /**
     * Returns the multiSig wallet information for bidding based on provided addresses and
     * public key
     *
     * @summary Get bidding wallet information
     * @throws FetchError<400, types.GetAddressBiddingWalletResponse400> Invalid parameters
     * @throws FetchError<500, types.GetAddressBiddingWalletResponse500> Internal server error
     */
    SDK.prototype.getAddressBiddingWallet = function (metadata) {
        return this.core.fetch('/address/bidding-wallet', 'get', metadata);
    };
    /**
     * Returns the contents of a wallet including ordinals and runes with optional filtering
     * and pagination
     *
     * @summary Get wallet contents
     * @throws FetchError<400, types.GetAddressWalletContentsResponse400> Invalid parameters
     * @throws FetchError<500, types.GetAddressWalletContentsResponse500> Internal server error
     */
    SDK.prototype.getAddressWalletContents = function (metadata) {
        return this.core.fetch('/address/wallet-contents', 'get', metadata);
    };
    /**
     * Retrieves the settings for a given asset. If no settings exist, it creates and returns
     * default settings.
     *
     * @summary Get asset settings by type and ticker
     * @throws FetchError<400, types.GetAssetSettingsTypeTickerResponse400> Invalid asset type provided.
     */
    SDK.prototype.getAssetSettingsTypeTicker = function (metadata) {
        return this.core.fetch('/asset-settings/{type}/{ticker}', 'get', metadata);
    };
    /**
     * Submit signed PSBT to fill/accept either an inscription bid or collection bid and
     * broadcast the item sale. The endpoint automatically detects the bid type based on the
     * provided parameters.
     *
     * @summary Fill/accept a bid
     * @throws FetchError<400, types.PostBidFillResponse400> Invalid parameters
     * @throws FetchError<500, types.PostBidFillResponse500> Internal server error
     */
    SDK.prototype.postBidFill = function (body) {
        return this.core.fetch('/bid/fill', 'post', body);
    };
    /**
     * Submit a signed PSBT to place a bid on either a specific inscription or a collection.
     * The endpoint automatically detects the bid type based on the provided parameters.
     *
     * @summary Place a bid on an inscription or collection
     * @throws FetchError<400, types.PostBidPlaceResponse400> Invalid parameters
     * @throws FetchError<500, types.PostBidPlaceResponse500> Internal server error
     */
    SDK.prototype.postBidPlace = function (body) {
        return this.core.fetch('/bid/place', 'post', body);
    };
    /**
     * Cancels a bid or ask order with signature verification
     *
     * @summary Cancel a bid or ask order
     * @throws FetchError<400, types.PostCancelResponse400> Invalid parameters
     * @throws FetchError<403, types.PostCancelResponse403> Invalid signature or unauthorized
     */
    SDK.prototype.postCancel = function (body) {
        return this.core.fetch('/cancel', 'post', body);
    };
    /**
     * Returns a challenge message that needs to be signed by the wallet
     *
     * @summary Get challenge message for wallet verification
     * @throws FetchError<400, types.GetChallengeResponse400> Invalid address
     */
    SDK.prototype.getChallenge = function (metadata) {
        return this.core.fetch('/challenge', 'get', metadata);
    };
    /**
     * Verifies that the provided signature is valid for the challenge
     *
     * @summary Verify signed challenge
     * @throws FetchError<400, types.GetChallengeVerifyResponse400> Missing or invalid parameters
     */
    SDK.prototype.getChallengeVerify = function (metadata) {
        return this.core.fetch('/challenge/verify', 'get', metadata);
    };
    /**
     * Returns collection statistics including floor price, listed count, and metadata
     *
     * @summary Get collection statistics
     * @throws FetchError<400, types.GetCollectionStatsResponse400> Invalid collection ID
     * @throws FetchError<404, types.GetCollectionStatsResponse404> Collection not found
     */
    SDK.prototype.getCollectionStats = function (metadata) {
        return this.core.fetch('/collection-stats', 'get', metadata);
    };
    /**
     * Returns floor prices for multiple collections by type (ordinals or runes)
     *
     * @summary Get collection floor prices
     * @throws FetchError<400, types.GetCollectionStatsFloorsResponse400> Invalid parameters
     * @throws FetchError<404, types.GetCollectionStatsFloorsResponse404> Collections not found
     */
    SDK.prototype.getCollectionStatsFloors = function (metadata) {
        return this.core.fetch('/collection-stats/floors', 'get', metadata);
    };
    /**
     * Returns collection metadata and optionally category attributes based on query parameters
     *
     * @summary Get details for collection
     * @throws FetchError<400, types.GetCollectionResponse400> Invalid parameters
     * @throws FetchError<404, types.GetCollectionResponse404> Collection not found
     */
    SDK.prototype.getCollection = function (metadata) {
        return this.core.fetch('/collection', 'get', metadata);
    };
    /**
     * Creates an unsigned PSBT for multisig withdraw that needs to be signed by the user
     *
     * @summary Create withdraw intent (unsigned PSBT)
     * @throws FetchError<400, types.PostIntentWithdrawResponse400> Invalid parameters
     */
    SDK.prototype.postIntentWithdraw = function (body) {
        return this.core.fetch('/intent/withdraw', 'post', body);
    };
    /**
     * Creates an unsigned PSBT for a single listing that needs to be signed by the user
     *
     * @summary Create Satflow listing intent (unsigned PSBT)
     */
    SDK.prototype.postIntentSell = function (body) {
        return this.core.fetch('/intent/sell', 'post', body);
    };
    /**
     * Creates unsigned PSBTs for multiple listings that need to be signed by the user
     *
     * @summary Create Satflow bulk listing intent (unsigned PSBTs)
     */
    SDK.prototype.postIntentBulkSell = function (body) {
        return this.core.fetch('/intent/bulk-sell', 'post', body);
    };
    /**
     * Creates an unsigned PSBT for accepting an inscription bid that needs to be signed by the
     * seller
     *
     * @summary Create accept bid intent (unsigned PSBT)
     */
    SDK.prototype.postIntentAccept = function (body) {
        return this.core.fetch('/intent/accept', 'post', body);
    };
    /**
     * Creates an unsigned PSBT for accepting collection bids that needs to be signed by the
     * seller
     *
     * @summary Create accept collection bid intent (unsigned PSBT)
     */
    SDK.prototype.postIntentAcceptCollectionBid = function (body) {
        return this.core.fetch('/intent/accept-collection-bid', 'post', body);
    };
    /**
     * Creates an unsigned PSBT for secure purchases that needs to be signed by the buyer
     *
     * @summary Create secure purchase intent (unsigned PSBT)
     * @throws FetchError<400, types.PostIntentSecurePurchaseResponse400> Invalid parameters
     */
    SDK.prototype.postIntentSecurePurchase = function (body) {
        return this.core.fetch('/intent/secure-purchase', 'post', body);
    };
    /**
     * Creates an unsigned PSBT for listing on external marketplaces that needs to be signed by
     * the seller
     *
     * @summary Create external marketplace listing intent (unsigned PSBTs)
     * @throws FetchError<400, types.PostIntentExternalSellResponse400> Invalid parameters
     */
    SDK.prototype.postIntentExternalSell = function (body) {
        return this.core.fetch('/intent/external-sell', 'post', body);
    };
    /**
     * Creates an unsigned PSBT for external marketplace purchases that needs to be signed by
     * the buyer
     *
     * @summary Create external purchase intent (unsigned PSBT)
     */
    SDK.prototype.postIntentExternalPurchase = function (body) {
        return this.core.fetch('/intent/external-purchase', 'post', body);
    };
    /**
     * Creates an unsigned PSBT for Satflow marketplace purchases that needs to be signed by
     * the buyer
     *
     * @summary Create Satflow purchase intent (unsigned PSBT)
     */
    SDK.prototype.postIntentSatflowPurchase = function (body) {
        return this.core.fetch('/intent/satflow-purchase', 'post', body);
    };
    /**
     * Returns ordinal inscription data, metadata for token and collection, listing data, and
     * bid data based on query parameters
     *
     * @summary Get details for item
     * @throws FetchError<400, types.GetItemResponse400> Invalid parameters
     * @throws FetchError<404, types.GetItemResponse404> Inscription not found
     */
    SDK.prototype.getItem = function (metadata) {
        return this.core.fetch('/item', 'get', metadata);
    };
    /**
     * Submit signed listing PSBTs to create active listings on the marketplace
     *
     * @summary Submit signed Satflow listing PSBTs
     * @throws FetchError<400, types.PostListResponse400> Invalid parameters
     * @throws FetchError<500, types.PostListResponse500> Internal server error
     */
    SDK.prototype.postList = function (body) {
        return this.core.fetch('/list', 'post', body);
    };
    /**
     * Submit signed listing PSBTs to create active listings on MagicEden marketplace
     *
     * @summary Submit signed external marketplace listing PSBTs
     * @throws FetchError<400, types.PostListExternalResponse400> Invalid parameters
     * @throws FetchError<500, types.PostListExternalResponse500> Internal server error
     */
    SDK.prototype.postListExternal = function (body) {
        return this.core.fetch('/list/external', 'post', body);
    };
    /**
     * Retrieve the floor listings for one or more collections by their IDs.
     *
     * @summary Get floor listings for collections
     * @throws FetchError<400, types.GetOrdersFloorResponse400> Invalid parameters, collectionIds is required.
     * @throws FetchError<500, types.GetOrdersFloorResponse500> Internal server error.
     */
    SDK.prototype.getOrdersFloor = function (metadata) {
        return this.core.fetch('/orders/floor', 'get', metadata);
    };
    /**
     * Broadcasts a signed purchase PSBT to complete the transaction. Used for both secure and
     * non-secure purchases.
     *
     * @summary Broadcast purchase transaction (signed PSBT)
     * @throws FetchError<400, types.PostPurchaseBroadcastResponse400> Invalid parameters
     * @throws FetchError<500, types.PostPurchaseBroadcastResponse500> Internal server error
     */
    SDK.prototype.postPurchaseBroadcast = function (body) {
        return this.core.fetch('/purchase/broadcast', 'post', body);
    };
    /**
     * Submits a signed external marketplace purchase PSBT to complete the transaction
     *
     * @summary Submit external purchase transaction (signed PSBT)
     * @throws FetchError<400, types.PostPurchaseExternalResponse400> Invalid parameters
     * @throws FetchError<500, types.PostPurchaseExternalResponse500> Internal server error
     */
    SDK.prototype.postPurchaseExternal = function (body) {
        return this.core.fetch('/purchase/external', 'post', body);
    };
    /**
     * Submit a signed multisig withdraw PSBT and broadcast it to the Bitcoin network
     *
     * @summary Submit signed withdraw PSBT
     * @throws FetchError<400, types.PostWithdrawResponse400> Invalid parameters or PSBT
     */
    SDK.prototype.postWithdraw = function (body) {
        return this.core.fetch('/withdraw', 'post', body);
    };
    return SDK;
}());
var createSDK = (function () { return new SDK(); })();
module.exports = createSDK;

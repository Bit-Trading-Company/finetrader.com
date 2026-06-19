import type * as types from './types';
import type { ConfigOptions, FetchResponse } from 'api/dist/core';
import Oas from 'oas';
import APICore from 'api/dist/core';
declare class SDK {
    spec: Oas;
    core: APICore;
    constructor();
    /**
     * Optionally configure various options that the SDK allows.
     *
     * @param config Object of supported SDK options and toggles.
     * @param config.timeout Override the default `fetch` request timeout of 30 seconds. This number
     * should be represented in milliseconds.
     */
    config(config: ConfigOptions): void;
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
    auth(...values: string[] | number[]): this;
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
    server(url: string, variables?: {}): void;
    /**
     * Returns bid activity data with optional filtering and pagination
     *
     * @summary Get bid activity data
     * @throws FetchError<400, types.GetActivityBidsResponse400> Invalid parameters
     */
    getActivityBids(metadata?: types.GetActivityBidsMetadataParam): Promise<FetchResponse<200, types.GetActivityBidsResponse200>>;
    /**
     * Returns sales activity data with optional filtering and pagination
     *
     * @summary Get sales activity data
     * @throws FetchError<400, types.GetActivitySalesResponse400> Invalid parameters
     */
    getActivitySales(metadata?: types.GetActivitySalesMetadataParam): Promise<FetchResponse<200, types.GetActivitySalesResponse200>>;
    /**
     * Returns listings activity data with optional filtering and pagination
     *
     * @summary Get listings activity data
     * @throws FetchError<400, types.GetActivityListingsResponse400> Invalid parameters
     */
    getActivityListings(metadata?: types.GetActivityListingsMetadataParam): Promise<FetchResponse<200, types.GetActivityListingsResponse200>>;
    /**
     * Returns an array of active bids placed by the specified address
     *
     * @summary Get active bids for an address
     * @throws FetchError<400, types.GetAddressBidsResponse400> Invalid parameters
     * @throws FetchError<404, types.GetAddressBidsResponse404> Address not found or no bids
     */
    getAddressBids(metadata: types.GetAddressBidsMetadataParam): Promise<FetchResponse<200, types.GetAddressBidsResponse200>>;
    /**
     * Returns the multiSig wallet information for bidding based on provided addresses and
     * public key
     *
     * @summary Get bidding wallet information
     * @throws FetchError<400, types.GetAddressBiddingWalletResponse400> Invalid parameters
     * @throws FetchError<500, types.GetAddressBiddingWalletResponse500> Internal server error
     */
    getAddressBiddingWallet(metadata: types.GetAddressBiddingWalletMetadataParam): Promise<FetchResponse<200, types.GetAddressBiddingWalletResponse200>>;
    /**
     * Returns the contents of a wallet including ordinals and runes with optional filtering
     * and pagination
     *
     * @summary Get wallet contents
     * @throws FetchError<400, types.GetAddressWalletContentsResponse400> Invalid parameters
     * @throws FetchError<500, types.GetAddressWalletContentsResponse500> Internal server error
     */
    getAddressWalletContents(metadata: types.GetAddressWalletContentsMetadataParam): Promise<FetchResponse<200, types.GetAddressWalletContentsResponse200>>;
    /**
     * Retrieves the settings for a given asset. If no settings exist, it creates and returns
     * default settings.
     *
     * @summary Get asset settings by type and ticker
     * @throws FetchError<400, types.GetAssetSettingsTypeTickerResponse400> Invalid asset type provided.
     */
    getAssetSettingsTypeTicker(metadata: types.GetAssetSettingsTypeTickerMetadataParam): Promise<FetchResponse<200, types.GetAssetSettingsTypeTickerResponse200>>;
    /**
     * Submit signed PSBT to fill/accept either an inscription bid or collection bid and
     * broadcast the item sale. The endpoint automatically detects the bid type based on the
     * provided parameters.
     *
     * @summary Fill/accept a bid
     * @throws FetchError<400, types.PostBidFillResponse400> Invalid parameters
     * @throws FetchError<500, types.PostBidFillResponse500> Internal server error
     */
    postBidFill(body: types.PostBidFillBodyParam): Promise<FetchResponse<200, types.PostBidFillResponse200>>;
    /**
     * Submit a signed PSBT to place a bid on either a specific inscription or a collection.
     * The endpoint automatically detects the bid type based on the provided parameters.
     *
     * @summary Place a bid on an inscription or collection
     * @throws FetchError<400, types.PostBidPlaceResponse400> Invalid parameters
     * @throws FetchError<500, types.PostBidPlaceResponse500> Internal server error
     */
    postBidPlace(body: types.PostBidPlaceBodyParam): Promise<FetchResponse<200, types.PostBidPlaceResponse200>>;
    /**
     * Cancels a bid or ask order with signature verification
     *
     * @summary Cancel a bid or ask order
     * @throws FetchError<400, types.PostCancelResponse400> Invalid parameters
     * @throws FetchError<403, types.PostCancelResponse403> Invalid signature or unauthorized
     */
    postCancel(body: types.PostCancelBodyParam): Promise<FetchResponse<200, types.PostCancelResponse200>>;
    /**
     * Returns a challenge message that needs to be signed by the wallet
     *
     * @summary Get challenge message for wallet verification
     * @throws FetchError<400, types.GetChallengeResponse400> Invalid address
     */
    getChallenge(metadata: types.GetChallengeMetadataParam): Promise<FetchResponse<200, types.GetChallengeResponse200>>;
    /**
     * Verifies that the provided signature is valid for the challenge
     *
     * @summary Verify signed challenge
     * @throws FetchError<400, types.GetChallengeVerifyResponse400> Missing or invalid parameters
     */
    getChallengeVerify(metadata: types.GetChallengeVerifyMetadataParam): Promise<FetchResponse<200, types.GetChallengeVerifyResponse200>>;
    /**
     * Returns collection statistics including floor price, listed count, and metadata
     *
     * @summary Get collection statistics
     * @throws FetchError<400, types.GetCollectionStatsResponse400> Invalid collection ID
     * @throws FetchError<404, types.GetCollectionStatsResponse404> Collection not found
     */
    getCollectionStats(metadata: types.GetCollectionStatsMetadataParam): Promise<FetchResponse<200, types.GetCollectionStatsResponse200>>;
    /**
     * Returns floor prices for multiple collections by type (ordinals or runes)
     *
     * @summary Get collection floor prices
     * @throws FetchError<400, types.GetCollectionStatsFloorsResponse400> Invalid parameters
     * @throws FetchError<404, types.GetCollectionStatsFloorsResponse404> Collections not found
     */
    getCollectionStatsFloors(metadata: types.GetCollectionStatsFloorsMetadataParam): Promise<FetchResponse<200, types.GetCollectionStatsFloorsResponse200>>;
    /**
     * Returns collection metadata and optionally category attributes based on query parameters
     *
     * @summary Get details for collection
     * @throws FetchError<400, types.GetCollectionResponse400> Invalid parameters
     * @throws FetchError<404, types.GetCollectionResponse404> Collection not found
     */
    getCollection(metadata: types.GetCollectionMetadataParam): Promise<FetchResponse<200, types.GetCollectionResponse200>>;
    /**
     * Creates an unsigned PSBT for multisig withdraw that needs to be signed by the user
     *
     * @summary Create withdraw intent (unsigned PSBT)
     * @throws FetchError<400, types.PostIntentWithdrawResponse400> Invalid parameters
     */
    postIntentWithdraw(body: types.PostIntentWithdrawBodyParam): Promise<FetchResponse<200, types.PostIntentWithdrawResponse200>>;
    /**
     * Creates an unsigned PSBT for a single listing that needs to be signed by the user
     *
     * @summary Create Satflow listing intent (unsigned PSBT)
     */
    postIntentSell(body: types.PostIntentSellBodyParam): Promise<FetchResponse<number, unknown>>;
    /**
     * Creates unsigned PSBTs for multiple listings that need to be signed by the user
     *
     * @summary Create Satflow bulk listing intent (unsigned PSBTs)
     */
    postIntentBulkSell(body: types.PostIntentBulkSellBodyParam): Promise<FetchResponse<number, unknown>>;
    /**
     * Creates an unsigned PSBT for accepting an inscription bid that needs to be signed by the
     * seller
     *
     * @summary Create accept bid intent (unsigned PSBT)
     */
    postIntentAccept(body: types.PostIntentAcceptBodyParam): Promise<FetchResponse<number, unknown>>;
    /**
     * Creates an unsigned PSBT for accepting collection bids that needs to be signed by the
     * seller
     *
     * @summary Create accept collection bid intent (unsigned PSBT)
     */
    postIntentAcceptCollectionBid(body: types.PostIntentAcceptCollectionBidBodyParam): Promise<FetchResponse<number, unknown>>;
    /**
     * Creates an unsigned PSBT for secure purchases that needs to be signed by the buyer
     *
     * @summary Create secure purchase intent (unsigned PSBT)
     * @throws FetchError<400, types.PostIntentSecurePurchaseResponse400> Invalid parameters
     */
    postIntentSecurePurchase(body: types.PostIntentSecurePurchaseBodyParam): Promise<FetchResponse<200, types.PostIntentSecurePurchaseResponse200>>;
    /**
     * Creates an unsigned PSBT for listing on external marketplaces that needs to be signed by
     * the seller
     *
     * @summary Create external marketplace listing intent (unsigned PSBTs)
     * @throws FetchError<400, types.PostIntentExternalSellResponse400> Invalid parameters
     */
    postIntentExternalSell(body: types.PostIntentExternalSellBodyParam): Promise<FetchResponse<200, types.PostIntentExternalSellResponse200>>;
    /**
     * Creates an unsigned PSBT for external marketplace purchases that needs to be signed by
     * the buyer
     *
     * @summary Create external purchase intent (unsigned PSBT)
     */
    postIntentExternalPurchase(body: types.PostIntentExternalPurchaseBodyParam): Promise<FetchResponse<number, unknown>>;
    /**
     * Creates an unsigned PSBT for Satflow marketplace purchases that needs to be signed by
     * the buyer
     *
     * @summary Create Satflow purchase intent (unsigned PSBT)
     */
    postIntentSatflowPurchase(body: types.PostIntentSatflowPurchaseBodyParam): Promise<FetchResponse<number, unknown>>;
    /**
     * Returns ordinal inscription data, metadata for token and collection, listing data, and
     * bid data based on query parameters
     *
     * @summary Get details for item
     * @throws FetchError<400, types.GetItemResponse400> Invalid parameters
     * @throws FetchError<404, types.GetItemResponse404> Inscription not found
     */
    getItem(metadata?: types.GetItemMetadataParam): Promise<FetchResponse<200, types.GetItemResponse200>>;
    /**
     * Submit signed listing PSBTs to create active listings on the marketplace
     *
     * @summary Submit signed Satflow listing PSBTs
     * @throws FetchError<400, types.PostListResponse400> Invalid parameters
     * @throws FetchError<500, types.PostListResponse500> Internal server error
     */
    postList(body: types.PostListBodyParam): Promise<FetchResponse<200, types.PostListResponse200>>;
    /**
     * Submit signed listing PSBTs to create active listings on MagicEden marketplace
     *
     * @summary Submit signed external marketplace listing PSBTs
     * @throws FetchError<400, types.PostListExternalResponse400> Invalid parameters
     * @throws FetchError<500, types.PostListExternalResponse500> Internal server error
     */
    postListExternal(body: types.PostListExternalBodyParam): Promise<FetchResponse<200, types.PostListExternalResponse200>>;
    /**
     * Retrieve the floor listings for one or more collections by their IDs.
     *
     * @summary Get floor listings for collections
     * @throws FetchError<400, types.GetOrdersFloorResponse400> Invalid parameters, collectionIds is required.
     * @throws FetchError<500, types.GetOrdersFloorResponse500> Internal server error.
     */
    getOrdersFloor(metadata: types.GetOrdersFloorMetadataParam): Promise<FetchResponse<200, types.GetOrdersFloorResponse200>>;
    /**
     * Broadcasts a signed purchase PSBT to complete the transaction. Used for both secure and
     * non-secure purchases.
     *
     * @summary Broadcast purchase transaction (signed PSBT)
     * @throws FetchError<400, types.PostPurchaseBroadcastResponse400> Invalid parameters
     * @throws FetchError<500, types.PostPurchaseBroadcastResponse500> Internal server error
     */
    postPurchaseBroadcast(body: types.PostPurchaseBroadcastBodyParam): Promise<FetchResponse<200, types.PostPurchaseBroadcastResponse200>>;
    /**
     * Submits a signed external marketplace purchase PSBT to complete the transaction
     *
     * @summary Submit external purchase transaction (signed PSBT)
     * @throws FetchError<400, types.PostPurchaseExternalResponse400> Invalid parameters
     * @throws FetchError<500, types.PostPurchaseExternalResponse500> Internal server error
     */
    postPurchaseExternal(body: types.PostPurchaseExternalBodyParam): Promise<FetchResponse<200, types.PostPurchaseExternalResponse200>>;
    /**
     * Submit a signed multisig withdraw PSBT and broadcast it to the Bitcoin network
     *
     * @summary Submit signed withdraw PSBT
     * @throws FetchError<400, types.PostWithdrawResponse400> Invalid parameters or PSBT
     */
    postWithdraw(body: types.PostWithdrawBodyParam): Promise<FetchResponse<200, types.PostWithdrawResponse200>>;
}
declare const createSDK: SDK;
export = createSDK;

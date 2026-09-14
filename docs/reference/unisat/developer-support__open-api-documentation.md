<!--
UniSat docs — Open API Documentation
Source: https://docs.unisat.io/developer-support/open-api-documentation.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

> For the complete documentation index, see [llms.txt](https://docs.unisat.io/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.unisat.io/developer-support/open-api-documentation.md).

# Open API Documentation

Welcome to UniSat Developer Center documentation

{% hint style="info" %} <mark style="color:orange;">Please read</mark> [Developer Service Legal Disclaimer](/developer-support/developer-service-legal-disclaimer.md) <mark style="color:orange;">before using the OpenAPI below.</mark>
{% endhint %}

<figure><img src="https://3523236551-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FJ4NHAHIVnWQiEecvs1By%2Fuploads%2FrItWXkDwExIiAXvWKX8M%2F20240516-175257.png?alt=media&amp;token=e1bf87fe-af60-47e9-a6d0-6342967180b0" alt=""><figcaption></figcaption></figure>

### Overview

UniSat Developer Service is open to community developers, allowing you to explore the world of Bitcoin and ordinals. You can deploy your own inscribing services, build wallet applications, develop browsers, and much more using the API.

### Getting an API Key

To use the OpenAPI, please register and log in at the [UniSat Developer Center](https://developer.unisat.io). Once registered, you can directly obtain a free-plan API key through the developer center.<br>

When you obtain the API key, please add it to the request header with the `Authorization` format as follows:

```bash
curl -X 'GET' \
  'https://open-api.unisat.io/v1/indexer/blockchain/info' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

### Endpoint URLs

<table><thead><tr><th>Network</th><th width="316">URL</th><th>Swagger</th></tr></thead><tbody><tr><td>Mainnet</td><td>https://open-api.unisat.io<br><br>https://open-api-s1.unisat.io (Only WhiteList)<br></td><td><a href="https://open-api.unisat.io/swagger.html">https://open-api.unisat.io/swagger.html</a></td></tr><tr><td>Testnet</td><td>https://open-api-testnet.unisat.io</td><td><a href="https://open-api-testnet.unisat.io/swagger.html">https://open-api-testnet.unisat.io/swagger.html</a></td></tr></tbody></table>

### Rate Limits

| API Tier | Rate Limit                             |
| -------- | -------------------------------------- |
| Free     | 5 calls/second , up to 2,000 calls/day |

{% hint style="info" %}
If you require higher limits than those provided by our free plan, you can directly purchase a higher-tier plan through the [UniSat Developer Center](https://developer.unisat.io/plan).
{% endhint %}

### Issues & Feature Requests

For issue reports and feature requests, please visit the repository below:

* <https://github.com/unisat-wallet/unisat-dev-support/issues>

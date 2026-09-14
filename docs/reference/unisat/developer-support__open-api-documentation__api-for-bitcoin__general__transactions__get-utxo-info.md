<!--
UniSat docs — Get UTXO Info
Source: https://docs.unisat.io/developer-support/open-api-documentation/api-for-bitcoin/general/transactions/get-utxo-info.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

> For the complete documentation index, see [llms.txt](https://docs.unisat.io/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.unisat.io/developer-support/open-api-documentation/api-for-bitcoin/general/transactions/get-utxo-info.md).

# Get UTXO Info

{% openapi src="/files/nKkGRaU7yLsgvnB68g6O" path="/v1/indexer/utxo/{txid}/{index}" method="get" %}
[swagger.yaml](https://3523236551-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FJ4NHAHIVnWQiEecvs1By%2Fuploads%2FTb9tBhNb9gZTI6HmfIuf%2Fswagger.yaml?alt=media\&token=4a135df5-1651-491f-a929-6e56077206c0)
{% endopenapi %}

The return result of this UTXO interface will have three scenarios:\ <br>

1. When UTXO has not been spent, it will return the information of this UTXO, and `isSpent` will be set to false.

<figure><img src="https://3523236551-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FJ4NHAHIVnWQiEecvs1By%2Fuploads%2FuSPxPwkcPfWDHdbaTFW3%2Fimage.png?alt=media&amp;token=f003683b-e476-4a90-ae1d-e26a033966d6" alt=""><figcaption></figcaption></figure>

2. When UTXO has been spent, but the transaction that spent it has not yet been confirmed, it will return the information of this UTXO, and `isSpent` will be set to true.

<figure><img src="https://3523236551-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FJ4NHAHIVnWQiEecvs1By%2Fuploads%2FSKwNRjOCCIrmqDpARLxD%2Fimage.png?alt=media&amp;token=b2c87db8-c991-44df-b45f-c29c21722b02" alt=""><figcaption></figcaption></figure>

3. When UTXO has been spent and the transacted spend has been confirmed, it will return null.

<figure><img src="https://3523236551-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FJ4NHAHIVnWQiEecvs1By%2Fuploads%2FIcx3pACMXZotUT1tAOEa%2Fimage.png?alt=media&amp;token=b409dd50-302e-4989-b3c1-5ae2e4e1eb4f" alt=""><figcaption></figcaption></figure>

# nft-swaps-data

This repo contains simple scripts to compare the usage of NFT trading platforms Sudoswap, NFTTrader and Swap.kiwi.

## Setup
```
git clone git@github.com:rkalis/nft-swaps-data.git
cd nft-swaps-data
yarn
```

Then create a `.env` file from the included `.env.example` file and fill in your own Alchemy and Moralis credentials.

### Usage
```
yarn measure
```

The entire script takes a long time to run (10+ minutes), so be patient. Also note that the entire script uses over 1M Alchemy compute units and a significant number of Moralis requests as well.

## How it works
The script filters on "completed swap" events on the respective contracts for the three different platforms. From there it uses Alchemy's "alchemy_getAssetTransfers" API to determine which assets were transferred in those swaps. Then it uses Moralis' "getTokenPrice" API to determine the price of ETH and all ERC20 tokens in the swap. To estimate the value of the NFTs in the swap it retrieves the latest 500 trades in the past from the Rarible "order/activities/search" API and calculates the average sale price. Note that the Rarible API includes sales on both Rarible and OpenSea.

The script makes a distinction between *swaps*, which contain NFTs on both sides of the trade, and *sales*, which only contains NFTs on a single side. Any trades that somehow do not include NFTs on either side have been filtered out.

## Latest data (2021-11-30)
```
Sudoswap 30d:
  Swaps: 209 ($3282k total / $16k average)
  Sales: 349 ($17102k total / $49k average)
NFTTrader 30d:
  Swaps: 281 ($8142k total / $29k average)
  Sales: 788 ($55833k total / $71k average)
Swap.kiwi 30d:
  Swaps: 42 ($2561k total / $61k average)
  Sales: 0 ($0k total / $0k average)
```

# nft-swaps-data

This repo contains simple scripts to compare the usage of NFT trading platforms Sudoswap, NFTTrader and Swap.kiwi.

## Setup
```
git clone git@github.com:rkalis/nft-swaps-data.git
cd nft-swaps-data
yarn
```

Then create a `.env` file from the included `.env.example` file and fill in your own Alchemy keys.

### Usage
```
yarn measure
```

The entire script takes a long time to run (in the order of tens of minutes to an hour), so be patient. Also note that the entire script uses 1-2M Alchemy compute units.

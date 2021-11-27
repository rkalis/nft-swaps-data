import { utils } from 'ethers';
import Moralis from 'moralis/node';
import moment from 'moment';
import got from 'got';
import { Asset, SimpleTrade, Trade } from './types';
import { ALCHEMY_ENDPOINT, MORALIS_APP_ID, MORALIS_SERVER_URL, WETH_ADDRESS } from './constants';

Moralis.start({
  serverUrl: MORALIS_SERVER_URL,
  appId: MORALIS_APP_ID,
});

export const getBlockForDate = (date: string) => {
  return Moralis.Web3API.native.getDateToBlock({ date });
}

export const splitTrades = (trades: Trade[]) => {
  // Sales trade 1 or more NFTs for non-NFT assets (but no NFTs)
  const sales = trades.filter((trade) => {
    const makerHasNfts = trade.makerAssets.some((asset) => ['ERC721', 'ERC1155'].includes(asset.class))
    const takerHasNfts = trade.takerAssets.some((asset) => ['ERC721', 'ERC1155'].includes(asset.class))
    return (makerHasNfts || takerHasNfts) && makerHasNfts !== takerHasNfts;
  });

  // Swaps trade 1 or more NFTs for 1 or more NFTs (+ more)
  const swaps = trades.filter((trade) => {
    const makerHasNfts = trade.makerAssets.some((asset) => ['ERC721', 'ERC1155'].includes(asset.class))
    const takerHasNfts = trade.takerAssets.some((asset) => ['ERC721', 'ERC1155'].includes(asset.class))
    return makerHasNfts && takerHasNfts;
  });

  return { sales, swaps };
}

export const transferToAsset = (transfer: any) => ({
  class: transfer.category == 'internal' || transfer.category == 'external' ? 'ETH' : transfer.category.toUpperCase(),
  contractAddress: transfer.rawContract?.address && utils.getAddress(transfer.rawContract?.address),
  amount: transfer.value,
})

export const getAllTransfersFromAlchemy = async (
  blockNumber: number,
  toAddress: string,
  transaction: string,
  pageKey?: string
): Promise<any[]> => {
  const alchemyRequest = {
    jsonrpc: '2.0',
    id: Math.random(),
    method: 'alchemy_getAssetTransfers',
    params: [{
      fromBlock: `0x${blockNumber.toString(16)}`,
      toBlock: `0x${blockNumber.toString(16)}`,
      category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
      toAddress,
      pageKey,
    }]
  }

  const { body: { result } } = await got.post(ALCHEMY_ENDPOINT, { json: alchemyRequest, responseType: 'json' }) as any;

  const additionalTransfers = result.pageKey
    ? await getAllTransfersFromAlchemy(blockNumber, toAddress, transaction, result.pageKey)
    : [];

  const transfersForTransaction = result.transfers.filter((transfer: any) => transfer.hash == transaction)

  const allTransfers = [...additionalTransfers, ...transfersForTransaction];

  return allTransfers;
}

export const addAssetsToTrades = async (simpleTrades: SimpleTrade[], chunkSize: number = 25) => {
  const trades = await performAsyncInChunks(simpleTrades, chunkSize, async (simpleTrade) => {
    const { transactionHash, blockNumber, maker, taker } = simpleTrade;

    const makerTransfers = await getAllTransfersFromAlchemy(blockNumber, taker, transactionHash);
    const takerTransfers = await getAllTransfersFromAlchemy(blockNumber, maker, transactionHash);

    const makerAssets = makerTransfers.map(transferToAsset);
    const takerAssets = takerTransfers.map(transferToAsset);

    return { maker, taker, makerAssets, takerAssets, transactionHash };
  });

  return trades;
}

export const totalVolume = (trades: Trade[]) => (
  Math.round(
    trades.reduce((totalVolume, trade) => (
      totalVolume + [...trade.makerAssets, ...trade.takerAssets].reduce((tradeVolume, asset) => (
        tradeVolume + (asset.value ?? 0)
      ), 0)
    ), 0)
  )
)

export const addValueToTrades = async (trades: Trade[]) => {
  const priceMap = await getAssetPriceMap(trades);
  return trades.map((trade) => ({
    ...trade,
    makerAssets: trade.makerAssets.map((asset) => addValueToAsset(asset, priceMap)),
    takerAssets: trade.takerAssets.map((asset) => addValueToAsset(asset, priceMap)),
  }))
}

export const addValueToAsset = (asset: Asset, priceMap: Map<string, number>) => {
  const address = asset.class === 'ETH' ? WETH_ADDRESS : asset.contractAddress!;
  const price = priceMap.get(address) ?? 0
  const value = price * (asset.amount ?? 1);

  // console.log(asset.class, address, price);

  return { ...asset, value };
}

export const getAssetPriceMap = async (trades: Trade[], chunkSize: number = 25) => {
  const allAssets = trades.flatMap((trade) => [...trade.makerAssets, ...trade.takerAssets])
  const wethAsset = {
    class: 'ERC20' as const,
    contractAddress: WETH_ADDRESS,
  };

  allAssets.unshift(wethAsset);

  const deduplicatedAssets = allAssets
    .filter((asset) => asset.class !== 'ETH')
    .filter((asset, i) => i === allAssets.findIndex((other) => asset.contractAddress === other.contractAddress));

  const prices = await performAsyncInChunks(deduplicatedAssets, chunkSize, (asset) => getAssetPriceEntry(asset));
  const priceMap = new Map(prices);

  return priceMap;
}

export const getAssetPriceEntry = async (asset: Asset): Promise<[string, number]> => {
  const address = asset.class === 'ETH' ? WETH_ADDRESS : asset.contractAddress!;
  const price = asset.class === 'ETH' || asset.class === 'ERC20'
    ? await getErc20Price(address)
    : await getNftPrice(address);

  return [address, price];
}

export const getEthPrice = async () => getErc20Price(WETH_ADDRESS)
export const getErc20Price = async (contractAddress: string): Promise<number> => {
  try {
    const { usdPrice } = await Moralis.Web3API.token.getTokenPrice({ address: contractAddress });
    return usdPrice
  } catch (e) {
    // console.log('>>> FAILED TO GET PRICE FROM MORALIS', contractAddress, e);
    return 0;
  }
}

export const getNftPrice = async (contractAddress: string): Promise<number> => {
  try {
    const fromDate = moment().subtract(7, 'days').toISOString();
    const { block: fromBlock } = await getBlockForDate(fromDate);

    const request = {
      '@type': 'by_collection',
      contract: contractAddress,
      types: ['MATCH'],
    }

    const { body: { items: sales } } = await got.post(
      'https://ethereum-api.rarible.org/v0.1/order/activities/search?size=500&sort=LATEST_FIRST',
      { json: request, responseType: 'json' },
    ) as any;

    const salesInRange = sales.filter((sale: any) => sale.blockNumber > fromBlock);
    if (salesInRange.length === 0) return 0;

    const totalPrice = salesInRange.reduce((totalPrice: number, sale: any) => totalPrice + (sale.priceUsd ?? 0), 0)
    const averagePrice = totalPrice / salesInRange.length;

    return averagePrice;
  } catch (e: any) {
    // console.log('>>> FAILED TO GET NFT PRICE', contractAddress, e);
    return 0;
  }
}

// https://stackoverflow.com/questions/40682103/splitting-an-array-up-into-chunks-of-a-given-size
export const splitArrayInChunks = <T>(array: T[], chunkSize: number) => {
  var arrayOfChunks: T[][] = [];
  for(var i = 0; i < array.length; i += chunkSize) {
    arrayOfChunks.push(array.slice(i, i + chunkSize));
  }
  return arrayOfChunks;
}

export const performAsyncInChunks = async <T, U>(array: T[], chunkSize: number, action: (elem: T) => Promise<U>) => {
  const chunks = splitArrayInChunks(array, chunkSize);

  let results: U[] = [];

  for (let chunk of chunks) {
    const chunkResult = await Promise.all(chunk.map(action));
    results = [...results, ...chunkResult];
  }

  return results;
};

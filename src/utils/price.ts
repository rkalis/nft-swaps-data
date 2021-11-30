import got from 'got';
import moment from 'moment';
import Moralis from 'moralis/node';
import { getBlockForDate, performAsyncInChunks } from '.';
import { WETH_ADDRESS } from '../constants';
import { Asset, Trade } from '../types';

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

export const totalVolume = (trades: Trade[]) => (
  Math.round(
    trades.reduce((totalVolume, trade) => (
      totalVolume + [...trade.makerAssets, ...trade.takerAssets].reduce((tradeVolume, asset) => (
        tradeVolume + (asset.value ?? 0)
      ), 0)
    ), 0)
  )
)

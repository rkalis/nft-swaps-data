import got from 'got';
import { SimpleTrade, Trade } from './types';
import { ALCHEMY_ENDPOINT } from './constants';

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
  contractAddress: transfer.rawContract?.address,
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

export const addAssetsToTrades = async (simpleTrades: SimpleTrade[], chunkSize: number = 100) => {
  // Split in chunks so that the calls don't fail sue to too many concurrent calls
  const chunks = splitArrayInChunks(simpleTrades, chunkSize);

  let trades: Trade[] = [];

  for (let chunk of chunks) {
    const tradesChunk = await Promise.all(chunk.map(async (simpleTrade) => {
      const { transactionHash, blockNumber, maker, taker } = simpleTrade;

      const makerTransfers = await getAllTransfersFromAlchemy(blockNumber, taker, transactionHash);
      const takerTransfers = await getAllTransfersFromAlchemy(blockNumber, maker, transactionHash);

      const makerAssets = makerTransfers.map(transferToAsset);
      const takerAssets = takerTransfers.map(transferToAsset);

      return { maker, taker, makerAssets, takerAssets, transactionHash };
    }));

    trades = [...trades, ...tradesChunk];
  }

  return trades;
}

// https://stackoverflow.com/questions/40682103/splitting-an-array-up-into-chunks-of-a-given-size
export const splitArrayInChunks = <T>(array: T[], chunkSize: number) => {
  var arrayOfChunks: T[][] = [];
  for(var i = 0; i < array.length; i += chunkSize) {
    arrayOfChunks.push(array.slice(i, i + chunkSize));
  }
  return arrayOfChunks;
}

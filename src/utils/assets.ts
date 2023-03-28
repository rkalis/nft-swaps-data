import { utils } from 'ethers';
import got from 'got';
import { ALCHEMY_ENDPOINT } from '../constants';
import { SimpleTrade } from '../types';
import { performAsyncInChunks } from '../utils';

export const assetFromAlchemyTransfer = (transfer: any) => ({
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

export const addAssetsToTrades = async (simpleTrades: SimpleTrade[], chunkSize: number = 1) => {
  const trades = await performAsyncInChunks(simpleTrades, chunkSize, async (simpleTrade) => {
    const { transactionHash, blockNumber, maker, taker } = simpleTrade;

    const makerTransfers = await getAllTransfersFromAlchemy(blockNumber, taker, transactionHash);
    const takerTransfers = await getAllTransfersFromAlchemy(blockNumber, maker, transactionHash);

    const makerAssets = makerTransfers.map(assetFromAlchemyTransfer);
    const takerAssets = takerTransfers.map(assetFromAlchemyTransfer);

    return { ...simpleTrade, makerAssets, takerAssets };
  });

  return trades;
}

import { Trade } from './types';
import { config } from 'dotenv';
import axios from 'axios';

config();

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

export const getAllTransfersFromAlchemy = async (blockNumber: number, toAddress: string, transaction: string, pageKey?: string) => {
  let id = Math.random();
  const alchemyRequest = {
    jsonrpc: '2.0',
    id,
    method: 'alchemy_getAssetTransfers',
    params: [{
      fromBlock: `0x${blockNumber.toString(16)}`,
      toBlock: `0x${blockNumber.toString(16)}`,
      category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
      toAddress,
      pageKey,
    }]
  }

  const { data: { result } } = await axios.post(
    `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_ID}`,
    alchemyRequest,
    );

  const additionalTransfers = result.pageKey
    ? await getAllTransfersFromAlchemy(blockNumber, toAddress, transaction, result.pageKey)
    : [];

  const transfersForTransaction = result.transfers.filter((transfer: any) => transfer.hash == transaction)

  const allTransfers = [...additionalTransfers, ...transfersForTransaction];

  return allTransfers;
}

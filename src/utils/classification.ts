import { Trade } from '../types';

export const classifyTrades = (trades: Trade[]) => {
  // Sales trade 1 or more NFTs for non-NFT assets (but no NFTs)
  const sales = trades.filter((trade) => {
    const makerHasNfts = trade.makerAssets.some((asset) => ['ERC721', 'ERC1155'].includes(asset.class))
    const takerHasNfts = trade.takerAssets.some((asset) => ['ERC721', 'ERC1155'].includes(asset.class))
    return (makerHasNfts || takerHasNfts) && !(makerHasNfts && takerHasNfts);
  });

  // Swaps trade 1 or more NFTs for 1 or more NFTs (+ more)
  const swaps = trades.filter((trade) => {
    const makerHasNfts = trade.makerAssets.some((asset) => ['ERC721', 'ERC1155'].includes(asset.class))
    const takerHasNfts = trade.takerAssets.some((asset) => ['ERC721', 'ERC1155'].includes(asset.class))
    return makerHasNfts && takerHasNfts;
  });

  return { sales, swaps };
}

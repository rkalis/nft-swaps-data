export interface Trade {
  transactionHash: string;
  maker: string;
  taker: string;
  makerAssets: Asset[];
  takerAssets: Asset[];
}

export interface Asset {
  class: 'ETH' | 'ERC20' | 'ERC721' | 'ERC1155';
  contract?: string;
  amount?: number;
}

export interface SimpleTrade {
  transactionHash: string;
  maker: string;
  taker: string;
  blockNumber: number;
}

export type Platform = 'Sudoswap' | 'NFTTrader' | 'Swap.kiwi';
export type Period = '1d' | '7d' | '30d';

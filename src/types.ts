export interface SimpleTrade {
  transactionHash: string;
  maker: string;
  taker: string;
  blockNumber: number;
}

export interface Trade extends SimpleTrade {
  makerAssets: Asset[];
  takerAssets: Asset[];
}

export interface Asset {
  class: 'ETH' | 'ERC20' | 'ERC721' | 'ERC1155';
  contractAddress?: string;
  amount?: number;
  value?: number;
}


export type Platform = 'Sudoswap' | 'NFTTrader' | 'Swap.kiwi';

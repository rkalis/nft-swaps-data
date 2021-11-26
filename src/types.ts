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

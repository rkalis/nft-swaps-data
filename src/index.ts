import { ethers, providers } from 'ethers';
import { config } from 'dotenv';
import { getAllTransfersFromAlchemy, splitTrades, transferToAsset } from './utils';
import { BLOCKS_1D, NFT_TRADER_ADDRESS, SUDOSWAP_ID, ZX_ADDRESS } from './constants';

config();

const provider = new providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.INFURA_ID}`);

const getAllSudoswapTrades = async (blocksAmount: number) => {
  const Fill = ethers.utils.id('Fill(address,address,address,address,uint256,uint256,uint256,uint256,bytes32,bytes,bytes)');
  const toBlock = await provider.getBlockNumber();
  const fromBlock = toBlock - blocksAmount;

  const fills = await provider.getLogs({
    fromBlock,
    toBlock,
    address: ZX_ADDRESS,
    topics: [Fill, null, ethers.utils.hexZeroPad(SUDOSWAP_ID, 32)],
  });

  const trades = await Promise.all(fills.map(async (fill) => {
    const { transactionHash, blockNumber } = fill;
    const transaction = await provider.getTransaction(transactionHash);
    const maker = ethers.utils.hexDataSlice(fill.topics[1], 12);
    const taker = transaction.from;

    const makerTransfers = await getAllTransfersFromAlchemy(blockNumber, taker, transactionHash);
    const takerTransfers = await getAllTransfersFromAlchemy(blockNumber, maker, transactionHash);

    const makerAssets = makerTransfers.map(transferToAsset);
    const takerAssets = takerTransfers.map(transferToAsset);

    return { maker, taker, makerAssets, takerAssets, transactionHash };
  }));

  return trades;
}

const getAllNftTraderTrades = async (blocksAmount: number) => {
  const SwapEvent = ethers.utils.id('swapEvent(address,uint256,uint8,uint256,address)');
  const toBlock = await provider.getBlockNumber();
  const fromBlock = toBlock - blocksAmount;

  const fills = await provider.getLogs({
    fromBlock,
    toBlock,
    address: NFT_TRADER_ADDRESS,
    topics: [SwapEvent],
  });

  const trades = await Promise.all(fills.map(async (fill) => {
    const { transactionHash, blockNumber } = fill;
    const transaction = await provider.getTransaction(transactionHash);
    const maker = ethers.utils.hexDataSlice(fill.data, 32 + 12);
    const taker = transaction.from;

    const makerTransfers = await getAllTransfersFromAlchemy(blockNumber, taker, transactionHash);
    const takerTransfers = await getAllTransfersFromAlchemy(blockNumber, maker, transactionHash);

    const makerAssets = makerTransfers.map(transferToAsset);
    const takerAssets = takerTransfers.map(transferToAsset);

    return { maker, taker, makerAssets, takerAssets, transactionHash };
  }));

  return trades;
}

const run = async () => {
  console.log('Sudoswap')
  const allSudoswapTrades = await getAllSudoswapTrades(BLOCKS_1D);
  const { sales: sudoswapSales, swaps: sudoswapSwaps } = splitTrades(allSudoswapTrades);
  console.log('Sales:', sudoswapSales.length, 'Swaps:', sudoswapSwaps.length);

  console.log('NFTTrader')
  const allNftTraderTrades = await getAllNftTraderTrades(BLOCKS_1D);
  const { sales: nftTraderSales, swaps: nftTraderSwaps } = splitTrades(allNftTraderTrades);
  console.log('Sales:', nftTraderSales.length, 'Swaps:', nftTraderSwaps.length);
}

run().catch(console.error)

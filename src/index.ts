import { ethers, providers } from 'ethers';
import { config } from 'dotenv';
import { getAllTransfersFromAlchemy, splitTrades, transferToAsset } from './utils';
import { BLOCKS_1D, BLOCKS_30D, BLOCKS_7D, NFT_TRADER_ADDRESS, SUDOSWAP_ID, SWAPKIWI_ADDRESS, SWAPKIWI_V13_ADDRESS, ZX_ADDRESS } from './constants';

config();

// const provider = new providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.INFURA_ID}`);
const provider = new providers.JsonRpcProvider(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_ID}`);

const getSudoswapTrades = async (blocksAmount: number) => {
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
    const maker = ethers.utils.hexDataSlice(fill.topics[1], 12);
    const taker = ethers.utils.hexDataSlice(fill.data, 12, 32);

    const makerTransfers = await getAllTransfersFromAlchemy(blockNumber, taker, transactionHash);
    const takerTransfers = await getAllTransfersFromAlchemy(blockNumber, maker, transactionHash);

    const makerAssets = makerTransfers.map(transferToAsset);
    const takerAssets = takerTransfers.map(transferToAsset);

    return { maker, taker, makerAssets, takerAssets, transactionHash };
  }));

  return trades;
}

const getNftTraderTrades = async (blocksAmount: number) => {
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
    const maker = ethers.utils.hexDataSlice(fill.data, 32 + 12);
    const taker = ethers.utils.hexDataSlice(fill.topics[1], 12);

    const makerTransfers = await getAllTransfersFromAlchemy(blockNumber, taker, transactionHash);
    const takerTransfers = await getAllTransfersFromAlchemy(blockNumber, maker, transactionHash);

    const makerAssets = makerTransfers.map(transferToAsset);
    const takerAssets = takerTransfers.map(transferToAsset);

    return { maker, taker, makerAssets, takerAssets, transactionHash };
  }));

  return trades;
}

const getSwapKiwiTrades = async (blocksAmount: number) => {
  const SwapExecuted = ethers.utils.id('SwapExecuted(address,address,uint256)');
  const toBlock = await provider.getBlockNumber();
  const fromBlock = toBlock - blocksAmount;

  const fillsV13 = await provider.getLogs({
    fromBlock,
    toBlock,
    address: SWAPKIWI_V13_ADDRESS,
    topics: [SwapExecuted],
  });

  const fillsV14 = await provider.getLogs({
    fromBlock,
    toBlock,
    address: SWAPKIWI_ADDRESS,
    topics: [SwapExecuted],
  });

  const fills = [...fillsV13, ...fillsV14];

  const trades = await Promise.all(fills.map(async (fill) => {
    const { transactionHash, blockNumber } = fill;
    const maker = ethers.utils.hexDataSlice(fill.topics[1], 12);
    const taker = ethers.utils.hexDataSlice(fill.topics[2], 12);

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
  const sudoswapTrades = await getSudoswapTrades(BLOCKS_1D);
  const { sales: sudoswapSales, swaps: sudoswapSwaps } = splitTrades(sudoswapTrades);
  console.log('1d', 'Sales:', sudoswapSales.length, 'Swaps:', sudoswapSwaps.length);

  console.log('NFTTrader')
  const nftTraderTrades = await getNftTraderTrades(BLOCKS_1D);
  const { sales: nftTraderSales, swaps: nftTraderSwaps } = splitTrades(nftTraderTrades);
  console.log('1d', 'Sales:', nftTraderSales.length, 'Swaps:', nftTraderSwaps.length);

  console.log('Swap.kiwi')
  const swapKiwiTrades = await getSwapKiwiTrades(BLOCKS_1D);
  const { sales: swapKiwiSales, swaps: swapKiwiSwaps } = splitTrades(swapKiwiTrades);
  console.log('1d', 'Sales:', swapKiwiSales.length, 'Swaps:', swapKiwiSwaps.length);
}

run().catch(console.error)

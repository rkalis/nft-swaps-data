import { ethers, providers } from 'ethers';
import { addAssetsToTrades, splitTrades } from './utils';
import { ALCHEMY_ENDPOINT, BLOCKS_1D, BLOCKS_30D, BLOCKS_7D, NFT_TRADER_ADDRESS, SUDOSWAP_ID, SWAPKIWI_ADDRESS, SWAPKIWI_V13_ADDRESS, ZX_ADDRESS } from './constants';
import { Period, Platform } from './types';

const provider = new providers.JsonRpcProvider(ALCHEMY_ENDPOINT);

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

  const simpleTrades = fills.map((fill) => ({
    transactionHash: fill.transactionHash,
    blockNumber: fill.blockNumber,
    maker: ethers.utils.hexDataSlice(fill.topics[1], 12),
    taker: ethers.utils.hexDataSlice(fill.data, 12, 32),
  }));

  const trades = await addAssetsToTrades(simpleTrades);

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

  const simpleTrades = fills.map((fill) => ({
    transactionHash: fill.transactionHash,
    blockNumber: fill.blockNumber,
    maker: ethers.utils.hexDataSlice(fill.data, 32 + 12),
    taker: ethers.utils.hexDataSlice(fill.topics[1], 12),
  }));

  const trades = await addAssetsToTrades(simpleTrades);

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

  const simpleTrades = fills.map((fill) => ({
    transactionHash: fill.transactionHash,
    blockNumber: fill.blockNumber,
    maker: ethers.utils.hexDataSlice(fill.topics[1], 12),
    taker: ethers.utils.hexDataSlice(fill.topics[2], 12),
  }));

  const trades = await addAssetsToTrades(simpleTrades);

  return trades;
}

const getTrades = (platform: Platform, period: Period) => {
  const getTradesFunctions = {
    Sudoswap: getSudoswapTrades,
    NFTTrader: getNftTraderTrades,
    'Swap.kiwi': getSwapKiwiTrades,
  };

  const blockAmounts = {
    '1d': BLOCKS_1D,
    '7d': BLOCKS_7D,
    '30d': BLOCKS_30D,
  };

  return getTradesFunctions[platform](blockAmounts[period]);
}

const logTrades = async (platform: Platform, period: Period) => {
  const trades = await getTrades(platform, period);
  const { sales, swaps } = splitTrades(trades);
  console.log(`${platform} ${period}:`,  `${sales.length} sales & ${swaps.length} swaps`);
}

const run = async () => {
  await logTrades('Sudoswap', '1d');
  await logTrades('Sudoswap', '7d');
  await logTrades('Sudoswap', '30d');
  await logTrades('NFTTrader', '1d');
  await logTrades('NFTTrader', '7d');
  await logTrades('NFTTrader', '30d');
  await logTrades('Swap.kiwi', '1d');
  await logTrades('Swap.kiwi', '7d');
  await logTrades('Swap.kiwi', '30d');
}

run().catch(console.error)

import { ethers, providers, utils } from 'ethers';
import moment from 'moment';
import { addAssetsToTrades, addValueToTrades, getBlockForDate, splitTrades, totalVolume } from './utils';
import { ALCHEMY_ENDPOINT, NFT_TRADER_ADDRESS, SUDOSWAP_ID, SWAPKIWI_ADDRESS, SWAPKIWI_V13_ADDRESS, ZX_ADDRESS } from './constants';
import { Platform } from './types';

const provider = new providers.JsonRpcProvider(ALCHEMY_ENDPOINT);

const getSudoswapTrades = async (fromBlock: number, toBlock: number) => {
  const Fill = ethers.utils.id('Fill(address,address,address,address,uint256,uint256,uint256,uint256,bytes32,bytes,bytes)');

  const fills = await provider.getLogs({
    fromBlock,
    toBlock,
    address: ZX_ADDRESS,
    topics: [Fill, null, ethers.utils.hexZeroPad(SUDOSWAP_ID, 32)],
  });

  const simpleTrades = fills.map((fill) => ({
    transactionHash: fill.transactionHash,
    blockNumber: fill.blockNumber,
    maker: utils.getAddress(ethers.utils.hexDataSlice(fill.topics[1], 12)),
    taker: utils.getAddress(ethers.utils.hexDataSlice(fill.data, 12, 32)),
  }));

  return simpleTrades;
}

const getNftTraderTrades = async (fromBlock: number, toBlock: number) => {
  const SwapEvent = ethers.utils.id('swapEvent(address,uint256,uint8,uint256,address)');

  const fills = await provider.getLogs({
    fromBlock,
    toBlock,
    address: NFT_TRADER_ADDRESS,
    topics: [SwapEvent],
  });

  const simpleTrades = fills.map((fill) => ({
    transactionHash: fill.transactionHash,
    blockNumber: fill.blockNumber,
    maker: utils.getAddress(ethers.utils.hexDataSlice(fill.data, 32 + 12)),
    taker: utils.getAddress(ethers.utils.hexDataSlice(fill.topics[1], 12)),
  }));

  return simpleTrades;
}

const getSwapKiwiTrades = async (fromBlock: number, toBlock: number) => {
  const SwapExecuted = ethers.utils.id('SwapExecuted(address,address,uint256)');

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
    maker: utils.getAddress(ethers.utils.hexDataSlice(fill.topics[1], 12)),
    taker: utils.getAddress(ethers.utils.hexDataSlice(fill.topics[2], 12)),
  }));

  return simpleTrades;
}

const getTrades = async (platform: Platform, days: number) => {
  const getTradesFunctions = {
    Sudoswap: getSudoswapTrades,
    NFTTrader: getNftTraderTrades,
    'Swap.kiwi': getSwapKiwiTrades,
  };

  const fromDate = moment().subtract(days, 'days').toISOString();
  const { block: fromBlock } = await getBlockForDate(fromDate);
  const blockNumber = await provider.getBlockNumber();

  const simpleTrades = await getTradesFunctions[platform](fromBlock, blockNumber);
  const fullTrades = await addValueToTrades(await addAssetsToTrades(simpleTrades));

  return fullTrades
}

const logTradeData = async (platform: Platform, days: number) => {
  console.log(`${platform} ${days}d:`)

  const trades = await getTrades(platform, days);
  const { sales, swaps } = splitTrades(trades);
  const swapVolume = Math.round(totalVolume(swaps) / 1000);
  const salesVolume = Math.round(totalVolume(sales) / 1000);

  console.log(`  Swaps: ${swaps.length} ($${swapVolume}k volume)`);
  console.log(`  Sales: ${sales.length} ($${salesVolume}k volume)`);
}

const run = async () => {
  // await logTradeData('Sudoswap', 1);
  // await logTradeData('Sudoswap', 7);
  await logTradeData('Sudoswap', 30);
  // await logTradeData('NFTTrader', 1);
  // await logTradeData('NFTTrader', 7);
  await logTradeData('NFTTrader', 30);
  // await logTradeData('Swap.kiwi', 1);
  // await logTradeData('Swap.kiwi', 7);
  await logTradeData('Swap.kiwi', 30);
}

run().catch(console.error)

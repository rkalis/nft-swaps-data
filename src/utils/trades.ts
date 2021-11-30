import { ethers, providers, utils } from 'ethers';
import moment from 'moment';
import { addAssetsToTrades } from '.';
import { ALCHEMY_ENDPOINT, NFT_TRADER_ADDRESS, SUDOSWAP_ID, SWAPKIWI_ADDRESS, SWAPKIWI_V13_ADDRESS, ZX_ADDRESS } from '../constants';
import { Platform } from '../types';
import { addValueToTrades, getBlockForDate } from '../utils';

const getSudoswapTrades = async (provider: providers.JsonRpcProvider, fromBlock: number, toBlock: number) => {
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

const getNftTraderTrades = async (provider: providers.JsonRpcProvider, fromBlock: number, toBlock: number) => {
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

const getSwapKiwiTrades = async (provider: providers.JsonRpcProvider, fromBlock: number, toBlock: number) => {
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

export const getSimpleTrades = async (platform: Platform, days: number) => {
  const provider = new providers.JsonRpcProvider(ALCHEMY_ENDPOINT);

  const getTradesFunctions = {
    Sudoswap: getSudoswapTrades,
    NFTTrader: getNftTraderTrades,
    'Swap.kiwi': getSwapKiwiTrades,
  };

  const fromDate = moment().subtract(days, 'days').toISOString();
  const { block: fromBlock } = await getBlockForDate(fromDate);
  const blockNumber = await provider.getBlockNumber();

  const simpleTrades = await getTradesFunctions[platform](provider, fromBlock, blockNumber);

  return simpleTrades;
}

export const getTrades = async (platform: Platform, days: number) =>
  await addValueToTrades(await addAssetsToTrades(await getSimpleTrades(platform, days)));

import { ethers, providers, utils } from 'ethers';
import { hexDataSlice } from 'ethers/lib/utils';
import moment from 'moment';
import { addAssetsToTrades } from '.';
import { ALCHEMY_ENDPOINT, NFT_TRADER_GNOSIS_SAFE_ADDRESS, SEAPORT_1_1_ADDRESS, SUDOSWAP_ID, SWAPKIWI_ADDRESS, ZX_ADDRESS } from '../constants';
import { Platform, SimpleTrade } from '../types';
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

// Updated 2023-03 (doesn't work before ~2022-05)
const getNftTraderTrades = async (provider: providers.JsonRpcProvider, fromBlock: number, toBlock: number) => {
  const SafeReceived = ethers.utils.id('SafeReceived(address,uint256)');

  // We get all transactions where the NFT Trader Gnosis Safe received ETH from the NFT Trader contract
  const fills = await provider.getLogs({
    fromBlock,
    toBlock,
    address: NFT_TRADER_GNOSIS_SAFE_ADDRESS,
    topics: [SafeReceived, ethers.utils.hexZeroPad(SEAPORT_1_1_ADDRESS, 32)],
  });

  const simpleTrades = await Promise.all(
    fills.map((event) => decodeSeaportTrade(provider, event.transactionHash, event.blockNumber))
  );

  return simpleTrades.filter((trade) => !!trade) as SimpleTrade[];
}

// Updated 2023-03 (doesn't work before ~2022-09)
const getSwapKiwiTrades = async (provider: providers.JsonRpcProvider, fromBlock: number, toBlock: number) => {
  const SwapExecuted = ethers.utils.id('SwapExecuted(address,address,uint64)');

  const fills = await provider.getLogs({
    fromBlock,
    toBlock,
    address: SWAPKIWI_ADDRESS,
    topics: [SwapExecuted],
  });

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

export const decodeSeaportTrade = async (provider: providers.JsonRpcProvider, transactionHash: string, blockNumber: number) => {
  const receipt = await provider.getTransactionReceipt(transactionHash);
  const seaportDetails = receipt.logs.find((log) => log.address === SEAPORT_1_1_ADDRESS && log.topics[0] === '0x9d9af8e38d66c62e2c12f0225249fd9d721c54b83f48d9352c97c6cacdcb6f31');
  if (!seaportDetails) return null;

  const maker = utils.getAddress(hexDataSlice(seaportDetails.topics[1], 12));
  const taker = utils.getAddress(hexDataSlice(seaportDetails.topics[2], 12));

  return { transactionHash, blockNumber, maker, taker };
}

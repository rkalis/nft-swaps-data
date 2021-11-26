import { ethers, providers } from 'ethers';
import { config } from 'dotenv';
import { getAllTransfersFromAlchemy, splitTrades, transferToAsset } from './utils';
import { BLOCKS_1D } from './constants';

config();

const provider = new providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.INFURA_ID}`);

const getAllSudoswapTrades = async (blocksAmount: number) => {
  const ZX_ADDRESS = '0x080bf510FCbF18b91105470639e9561022937712';
  const SUDOSWAP_ID = '0x4e2f98c96e2d595a83AFa35888C4af58Ac343E44';
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

    const makerTransfers = await getAllTransfersFromAlchemy(blockNumber, blockNumber, maker, transactionHash);
    const takerTransfers = await getAllTransfersFromAlchemy(blockNumber, blockNumber, taker, transactionHash);

    const makerAssets = makerTransfers.map(transferToAsset);
    const takerAssets = takerTransfers.map(transferToAsset);

    return { maker, taker, makerAssets, takerAssets, transactionHash };
  }));

  return trades;
}

const run = async () => {
  const allSudoswapTrades = await getAllSudoswapTrades(BLOCKS_1D);
  const { sales, swaps } = splitTrades(allSudoswapTrades);
  console.log('Sudoswap')
  console.log('Sales:', sales.length, 'Swaps:', swaps.length);
}

run().catch(console.error)

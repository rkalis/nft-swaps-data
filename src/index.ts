import { Platform } from './types';
import { getTrades, classifyTrades, totalVolume } from './utils';

const logTradeData = async (platform: Platform, days: number) => {
  console.log(`${platform} ${days}d:`)

  const trades = await getTrades(platform, days);
  const { sales, swaps } = classifyTrades(trades);
  const swapVolume = Math.round(totalVolume(swaps) / 1000);
  const salesVolume = Math.round(totalVolume(sales) / 1000);
  const averageSwapValue = Math.round(swapVolume / swaps.length) || 0;
  const averageSaleValue = Math.round(salesVolume / sales.length) || 0;

  console.log(`  Swaps: ${swaps.length} ($${swapVolume}k total / $${averageSwapValue}k average)`);
  console.log(`  Sales: ${sales.length} ($${salesVolume}k total / $${averageSaleValue}k average)`);
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

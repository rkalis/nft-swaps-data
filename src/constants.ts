import { config } from 'dotenv';
config();

export const BLOCK_TIME = 13;
export const SECONDS_1D = 60 * 60 * 24;
export const BLOCKS_1D = Math.round(SECONDS_1D / BLOCK_TIME);
export const BLOCKS_7D = 7 * BLOCKS_1D;
export const BLOCKS_30D = 30 * BLOCKS_1D;

export const ZX_ADDRESS = '0x080bf510FCbF18b91105470639e9561022937712';
export const SUDOSWAP_ID = '0x4e2f98c96e2d595a83AFa35888C4af58Ac343E44';
export const NFT_TRADER_ADDRESS = '0xC310e760778ECBca4C65B6C559874757A4c4Ece0';
export const SWAPKIWI_ADDRESS = '0x4748495153FB86637e4fDD8E50e3c1f611f15930';
export const SWAPKIWI_V13_ADDRESS = '0x1c1919Ec9de318b58fA66baE7449438C673E10B8';
export const ALCHEMY_ENDPOINT = `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`;
export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const { MORALIS_SERVER_URL, MORALIS_APP_ID } = process.env

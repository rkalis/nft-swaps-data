import Moralis from 'moralis';
import { MORALIS_API_KEY } from '../constants';

Moralis.start({
  apiKey: MORALIS_API_KEY,
});

export * from './trades';
export * from './assets';
export * from './price';
export * from './classification';
export * from './misc';

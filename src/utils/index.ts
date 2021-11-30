import Moralis from 'moralis/node';
import { MORALIS_APP_ID, MORALIS_SERVER_URL } from '../constants';

Moralis.start({
  serverUrl: MORALIS_SERVER_URL,
  appId: MORALIS_APP_ID,
});

export * from './trades';
export * from './assets';
export * from './price';
export * from './classification';
export * from './misc';

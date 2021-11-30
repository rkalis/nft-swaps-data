import Moralis from 'moralis/node';

export const getBlockForDate = (date: string) => {
  return Moralis.Web3API.native.getDateToBlock({ date });
}

// https://stackoverflow.com/questions/40682103/splitting-an-array-up-into-chunks-of-a-given-size
export const splitArrayInChunks = <T>(array: T[], chunkSize: number) => {
  var arrayOfChunks: T[][] = [];
  for(var i = 0; i < array.length; i += chunkSize) {
    arrayOfChunks.push(array.slice(i, i + chunkSize));
  }
  return arrayOfChunks;
}

export const performAsyncInChunks = async <T, U>(array: T[], chunkSize: number, action: (elem: T) => Promise<U>) => {
  const chunks = splitArrayInChunks(array, chunkSize);

  let results: U[] = [];

  for (let chunk of chunks) {
    const chunkResult = await Promise.all(chunk.map(action));
    results = [...results, ...chunkResult];
  }

  return results;
};

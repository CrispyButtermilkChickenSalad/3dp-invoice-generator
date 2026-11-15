import { reconstructResin } from './resin.js';

self.onmessage = async ({ data }) => {
  try {
    const volumeMl = await reconstructResin(data.file, data.geometry, progress => self.postMessage({ progress }));
    self.postMessage({ volumeMl });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};

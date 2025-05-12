import uiManager from "./UIManager.js";
import { API_URL } from "../config/config.js";

let networkTimeOffset = 0;

export function getNetworkTimeOffset() {
  return networkTimeOffset;
}

export function synchronizeClockWithServer(sampleSize = 5) {
  const samples = [];
  let sampleCount = 0;

  function collectSample() {
    const start = Date.now();

    fetch(API_URL+"/api/sync", {
      method: "GET",
      mode: "cors",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error("Synchronization failed");
        }
      })
      .then((serverTime) => {
        const end = Date.now();
        const rtt = end - start;
        let newNetworkTimeOffset = 0;

        samples.push({
          offset: (serverTime - start - (rtt / 2)),
          rtt: rtt,
        });

        sampleCount++;

        if (sampleCount < sampleSize) {
          setTimeout(collectSample, 100);
        } else {
          for (let i = 0; i < sampleSize; i++) {
            newNetworkTimeOffset += samples[i].offset;
          }
          networkTimeOffset = newNetworkTimeOffset / samples.length;
          
          uiManager.updateNetworkOffset(networkTimeOffset);
        }
      })
      .catch((error) => console.error("Clock synchronization error:", error));
  }

  collectSample();
}

export function startNetworkSyncInterval() {
  setInterval(() => {
    synchronizeClockWithServer(5);
  }, 60000);
}

const noble = require('@abandonware/noble');
const EventEmitter = require('events');

const RAPT_MFG_ID = 0x5241;
const V2_MSG_TYPE = '505402';
const DEDUPE_WINDOW_MS = 4 * 60_000; // 4 minutes (Pill reports every 5 min)

class RaptPillScanner extends EventEmitter {
  constructor({ pills = [], gravityOffset = 0, tempOffset = 0 } = {}) {
    super();
    // pills: [{ mac, name, gravityOffset, tempOffset }]
    this.pills = pills.map((p) => ({
      mac: p.mac ? p.mac.toLowerCase() : null,
      name: p.name,
      gravityOffset: p.gravityOffset ?? gravityOffset,
      tempOffset: p.tempOffset ?? tempOffset,
      lastSeenTime: 0,
    }));
    this.filterByMac = this.pills.some((p) => p.mac);
    this.defaultGravityOffset = gravityOffset;
    this.defaultTempOffset = tempOffset;
    this.unknownLastSeenTime = 0;
  }

  start() {
    noble.on('stateChange', (state) => {
      if (state === 'poweredOn') {
        console.log('[BLE] Bluetooth powered on, scanning for RAPT Pill...');
        noble.startScanning([], true);
      } else {
        console.log(`[BLE] Bluetooth state: ${state}`);
        noble.stopScanning();
      }
    });

    noble.on('discover', (peripheral) => this._onDiscover(peripheral));
  }

  _onDiscover(peripheral) {
    const mfgData = peripheral.advertisement.manufacturerData;
    if (!mfgData || mfgData.length < 25) {
      return;
    }

    const mfgId = mfgData.readUInt16BE(0);
    if (mfgId !== RAPT_MFG_ID) {
      return;
    }

    const msgType = mfgData.slice(2, 5).toString('hex');
    if (msgType !== V2_MSG_TYPE) {
      return;
    }

    if (mfgData[5] !== 0x00) {
      return;
    }

    const mac = peripheral.address.toLowerCase();
    const now = Date.now();

    // Find matching pill config
    const pill = this.pills.find((p) => p.mac === mac);

    if (this.filterByMac && !pill) {
      return; // Known pills configured but this MAC isn't one of them
    }

    // Per-pill dedupe
    if (pill) {
      if (now - pill.lastSeenTime < DEDUPE_WINDOW_MS) {
        return;
      }
      pill.lastSeenTime = now;
    } else {
      // No pills configured — accept any, dedupe globally
      if (now - this.unknownLastSeenTime < DEDUPE_WINDOW_MS) {
        return;
      }
      this.unknownLastSeenTime = now;
    }

    const gravityOffset = pill ? pill.gravityOffset : this.defaultGravityOffset;
    const tempOffset = pill ? pill.tempOffset : this.defaultTempOffset;
    const name = pill ? pill.name : mac;

    const reading = this._decode(mfgData, peripheral, gravityOffset, tempOffset, name);
    this.emit('reading', reading);
  }

  _decode(mfgData, peripheral, gravityOffset, tempOffset, pillName) {
    const gravityVelocityValid = mfgData[6] === 0x01;
    const gravityVelocity = gravityVelocityValid ? mfgData.readFloatBE(7) : null;

    const tempRaw = mfgData.readUInt16BE(11);
    const temperatureC = parseFloat(((tempRaw / 128) - 273.15 + tempOffset).toFixed(2));

    const sgRaw = mfgData.readFloatBE(13);
    const specificGravity = parseFloat((sgRaw / 1000 + gravityOffset).toFixed(4));

    const batteryRaw = mfgData.readUInt16BE(23);
    const battery = parseFloat(Math.min(batteryRaw / 256, 100).toFixed(1));

    return {
      pillName,
      specificGravity,
      temperatureC,
      gravityVelocity,
      battery,
      rssi: peripheral.rssi,
      mac: peripheral.address,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { RaptPillScanner };

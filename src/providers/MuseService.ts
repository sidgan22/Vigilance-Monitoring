import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, merge, Observable, Subject } from 'rxjs';
import { filter, map, concatMap, share, take, scan } from 'rxjs/operators';
import { LoadingController } from '@ionic/angular';

import { BLEService } from '../providers/BLEService';


const SVCNAME = 'MuseService';


/////INTERFACE DEFINITIONS//////

export interface EEGSample {
  index: number;
  timestamp: number; // milliseconds since epoch
  data: number[];
}

export interface EEGReading {
  index: number;
  electrode: number; // 0 to 4
  timestamp: number; // milliseconds since epoch
  samples: number[]; // 12 samples each time
}

export interface ControlResponse {
  rc: number;
  [key: string]: string | number;
}

/////MUSE CONST DEFINITIONS//////

export const MUSE_SERVICE = '0000fe8d-0000-1000-8000-00805f9b34fb'; // 0xfe8d;

export const CONTROL_CHARACTERISTIC = '273e0001-4c4d-454d-96be-f03bac821358';
export const EEG_CHARACTERISTICS = [
  '273e0003-4c4d-454d-96be-f03bac821358',
  '273e0004-4c4d-454d-96be-f03bac821358',
  '273e0005-4c4d-454d-96be-f03bac821358',
  '273e0006-4c4d-454d-96be-f03bac821358',
  '273e0007-4c4d-454d-96be-f03bac821358',
];

export const CHANNELNAMES = ['TP9', 'AF7', 'AF8', 'TP10', 'AUX'];

export const EEG_FREQUENCY = 256; //Hz
export const SAMPLING_PERIOD = 3.90625; // in ms

const CONNECTION_ATTEMPTS = 3;

export const SCAN_DURATION = 5;


//////MUSE PARSE FUNCTIONS//////

export function parseControl(controlData: Observable<string>) {
  return controlData.pipe(
    concatMap((data) => data.split('')),
    scan((acc, value) => {
      if (acc.indexOf('}') >= 0) {
        return value;
      } else {
        return acc + value;
      }
    }, ''),
    filter((value) => value.indexOf('}') >= 0),
    map((value) => JSON.parse(value)),
  );
}

export function decodeUnsigned12BitData(samples: Uint8Array) {
  const samples12Bit = [];
  // tslint:disable:no-bitwise
  for (let i = 0; i < samples.length; i++) {
    if (i % 3 === 0) {
      samples12Bit.push(samples[i] << 4 | samples[i + 1] >> 4);
    } else {
      samples12Bit.push((samples[i] & 0xf) << 8 | samples[i + 1]);
      i++;
    }
  }
  // tslint:enable:no-bitwise
  return samples12Bit;
}

export function decodeEEGSamples(samples: Uint8Array) {
  return decodeUnsigned12BitData(samples)
    .map((n) => 0.48828125 * (n - 0x800));
}



//////MUSE UTILS FUNCTIONS//////

export function decodeResponse(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.subarray(1, 1 + bytes[0]));
}

export function encodeCommand(cmd: string) {
  const encoded = new TextEncoder().encode(`X${cmd}\n`);
  encoded[0] = encoded.length - 1;
  return encoded;
}

@Injectable({
  providedIn: 'root'
})

export class MuseService {

  registeredID: string = "00:55:DA:BB:14:67";

  discoveredDevices: any[] = [];
  connectedDevice: any;
  connectedFlag: boolean = false;
  connectionStatus = new BehaviorSubject<number>(-1);
  streamingStatus = new BehaviorSubject<number>(-1);

  enableAux: boolean = false;
  deviceName: string | null = '';

  rawControlData: Observable<string>;
  controlResponses: Observable<ControlResponse>;
  eegReadings: Observable<EEGReading>;


  private lastIndex: number | null = null;
  private lastTimestamp: number | null = null;

  loader: any;

  constructor(public ble: BLEService,
    private loading: LoadingController,
    private ngzone: NgZone) {
  }

  //////SCAN AND CONNECT RELATED METHODS//////

  checkAndScan() {
    this.discoveredDevices = [];  // clear list
    this.ble.isEnabled().then(() => {
      this.scan();
    },
      () => {
        this.ble.enable().then(() => {
          this.scan();
        });
      }
    );
  }

  //Scan for devices : if name is '' then all devices sent back; if name is specified only those devices connected and sent back
  scan(name: string = 'Muse'): Observable<any> {
    var updateObservable: any;
    let observer = new Observable((observer) => {
      updateObservable = (val) => {
        if (val == '') {
          observer.error();
        } else if (val == 'non') {
          // non muse device - nothing to do
        } else {
          observer.next(val);
        }
      }
    });
    this.ble.scan([], SCAN_DURATION).subscribe(
      device => {
        if (name == '') {
          updateObservable(device);
        } else {
          if (device.name && device.name.includes(name) && device.id && this.registeredID && (device.id == this.registeredID)) {
            updateObservable(device);
            if (this.connectedFlag == true) {
              updateObservable(device);
            } else {
              this.enableAndConnect(device.id);
              updateObservable(device);
            }
          } else {
            updateObservable('non');
          }
        }
      },
      error => {
        updateObservable('');
      },
    );
    return observer;
  } //scan

  async enableAndConnect(sn) {
    this.ble.enable().then(
      () => this.connect(null, null, sn)
    );
  }


  async connect(attempts, loader, sn) {
    if (sn) {
      if (attempts) {
        this.ble.connect(sn).subscribe(
          (device) => {
            this.onConnected(device, loader);
          },
          (error) => {
            this.onDisconnected(sn, attempts, loader);
          }
        );
      }
      else {
        let loader = await this.loading.create({ message: 'Connecting...' });
        loader.present().then(() => {
          this.connect(CONNECTION_ATTEMPTS, loader, sn);
        });
      }
    } else {
      this.checkAndScan();
    }
  } //connect

  onConnected(p, loader) {
    if (loader)
      loader.dismiss();
    console.log("In OnConnected : " + p.toString());
    this.connectedDevice = p;
    this.connectedFlag = true;
    this.connectionStatus.next(1);
    this.deviceName = p.name;
    this.startNotifications();
  }

  startNotifications() {

    this.startControlNotification();
    this.controlResponses = parseControl(this.rawControlData);
    this.startEEGNotification();

  };

  onDisconnected(sn, attempts, loader) {
    this.connectionStatus.next(0);
    if (this.connectedFlag == false) {
      // Failed to connect
      if ((attempts == CONNECTION_ATTEMPTS) && (loader == undefined)) {
        // Can happen e.g. if wrong PIN entered
        this.connect(null, null, sn);
      } else {
        let lessAttempts = attempts - 1;
        if (lessAttempts > 0) {
          setTimeout(() => {
            this.connect(lessAttempts, loader, sn);
          }, 1000);
        } else {
          if (loader)
            loader.dismiss();
          setTimeout(() => {
            this.checkAndScan();
          }, 1000);
        }
      }
    } else {
      if (loader)
        loader.dismiss();
      this.connectedFlag = false;
    }
  }


  async disconnect() {
    if (this.ble) {
      this.lastIndex = null;
      this.lastTimestamp = null;
      this.ble.disconnect(null, this.connectedDevice.id, null, null);
      this.streamingStatus.next(0);
      this.connectionStatus.next(0);
      this.connectedFlag = false;
    }
  }

  //////STREAMING RELATED METHODS//////

  async sendCommand(cmd: string) {
    await this.ble.ble.writeWithoutResponse(this.connectedDevice.id, MUSE_SERVICE, CONTROL_CHARACTERISTIC, encodeCommand(cmd).buffer);
  }

  async start() {
    await this.pause();
    const preset = this.enableAux ? 'p20' : 'p21';
    await this.sendCommand(preset);
    await this.sendCommand('s');
    await this.resume();
  }

  async pause() {
    await this.sendCommand('h');
  }

  async resume() {
    await this.sendCommand('d');
  }

  async stop() {
    await this.pause();
    await this.stopNotifications();
  }


  private getTimestamp(eventIndex: number) {
    const SAMPLES_PER_READING = 12;
    const READING_DELTA = 1000 * (1.0 / EEG_FREQUENCY) * SAMPLES_PER_READING;
    if (this.lastIndex === null || this.lastTimestamp === null) {
      this.lastIndex = eventIndex;
      this.lastTimestamp = new Date().getTime() - READING_DELTA;
    }

    // Handle wrap around
    while (this.lastIndex - eventIndex > 0x1000) {
      eventIndex += 0x10000;
    }

    if (eventIndex === this.lastIndex) {
      return this.lastTimestamp;
    }
    if (eventIndex > this.lastIndex) {
      this.lastTimestamp += READING_DELTA * (eventIndex - this.lastIndex);
      this.lastIndex = eventIndex;
      return this.lastTimestamp;
    } else {
      return this.lastTimestamp - READING_DELTA * (this.lastIndex - eventIndex);
    }
  }


  //////NOTIFICATION FUNCTIONS//////

  async startControlNotification() {
    this.rawControlData = this.ble.ble.startNotification(this.connectedDevice.id, MUSE_SERVICE, CONTROL_CHARACTERISTIC).pipe(
      map((data) => decodeResponse(data[0])),
      share(),
    );

  }

  async startEEGNotification() {
    const eegObservables = [];
    const channelCount = this.enableAux ? EEG_CHARACTERISTICS.length : 4;
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
      eegObservables.push(this.ble.ble.startNotification(this.connectedDevice.id, MUSE_SERVICE, EEG_CHARACTERISTICS[channelIndex]).pipe(
        map((data) => {
          const eventIndex = new DataView(data[0]).getUint16(0);
          return {
            electrode: channelIndex,
            index: eventIndex,
            samples: decodeEEGSamples(new Uint8Array(data[0]).subarray(2)),
            timestamp: this.getTimestamp(eventIndex),
          };
        })
      )
      ) //push
    }
    this.eegReadings = merge(...eegObservables);
    this.streamingStatus.next(1);

  }

  async stopNotifications() {
    const channelCount = this.enableAux ? EEG_CHARACTERISTICS.length : 4;
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
      await this.ble.ble.stopNotification(this.connectedDevice.id, MUSE_SERVICE, EEG_CHARACTERISTICS[channelIndex]);
    };
    await this.ble.ble.stopNotification(this.connectedDevice.id, MUSE_SERVICE, CONTROL_CHARACTERISTIC);

  }

}
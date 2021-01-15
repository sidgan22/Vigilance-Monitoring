import { Injectable } from '@angular/core';
import { BLE } from '@ionic-native/ble/ngx';
import { Observable, Subject } from 'rxjs';

const SVCNAME = 'BLEService';

@Injectable({
    providedIn: 'root'
})

export class BLEService {

    constructor(public ble: BLE,) {

    }

    ////// CONNECT - DISCONNECT //////

    isEnabled() {
        return this.ble.isEnabled();
    }

    enable() {
        return this.ble.enable();
    }

    scan(services: string[] = [], seconds: number = 5): Observable<any> {
        return this.ble.scan(services, seconds);
    } //scan

    connect(sn) {
        return this.ble.connect(sn);
    }

    disconnect(p, sn, success, failure) {
        this.ble.isConnected(sn).then(() => {
            this.ble.disconnect(sn).then(success, failure);
        }, (err) => {
        });
    }

    ///// NOTIFICATION METHODS ////////

    stopNotification(sn: string, service: string, characteristic: string) {
        this.ble.isConnected(sn).then(() => {
            return this.ble.stopNotification(sn, service, characteristic);
        }, () => {
            return new Promise<any>((resolve, reject) => {
                reject();
            });
        });
    }

    ////// READ AND WRITE METHODS //////

    async write(deviceId: string, serviceID: string, characteristicID: string, buffer: ArrayBuffer) {
        return new Promise((resolve, reject) => {
            this.ble.write(
                deviceId,
                serviceID,
                characteristicID,
                buffer
            ).then(() => {
                resolve(true);
            }, (err) => {
                console.error('write failed!');
                reject(false);
            });
        });
    }

    async writeWithoutResponse(deviceId: string, serviceID: string, characteristicID: string, buffer: ArrayBuffer) {
        return new Promise((resolve, reject) => {
            this.ble.writeWithoutResponse(
                deviceId,
                serviceID,
                characteristicID,
                buffer
            ).then(() => {
                resolve(true);
            }, (err) => {
                console.error('write failed!');
                reject(false);
            });
        });
    }

    async read(deviceId: string, serviceID: string, characteristicID: string) {
        let readval = -1;
        let data = await this.ble.read(deviceId, serviceID, characteristicID);
        readval = data[0];
        return (readval);
    }

}
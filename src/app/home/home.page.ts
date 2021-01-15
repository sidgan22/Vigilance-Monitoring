
import { Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { MuseService, EEG_FREQUENCY, SAMPLING_PERIOD } from 'src/providers/MuseService';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})

export class HomePage {
  times: Array<number> = [];
  signal: Array<number> = [];
  cumSignal: Array<number> = [];
  dummy: Array<number> = [];
  resi: number[];
  resr: number[];
  finalres = [];

  drowsinessFlag: string = 'Unknown';
  drowsinessThreshold = [-1, -1];


  eyeStatus = [
    "Closed",
    "Closed",
    "Closed",
    "Closed",
    "Closed",
    "Closed",
    "Open",
    "Open",
    "Open",
    "Open",
    "Open",
    "Open",
    "Closed",
    "Closed",
    "Closed",
    "Open",
    "Open",
    "Open",
    "Closed",
    "Closed",
    "Closed",
    "Open",
    "Open",
    "Open",
    "Closed",
    "Closed",
    "Open",
    "Open",
    "Closed",
    "Closed",
    "Open",
    "Open",]
  alphaBand = [8, 13];
  thetaBand = [4, 8];
  thetaBandPower = 0;
  alphaBandPower = 0;
  thetaBandPowers = [];
  alphaBandPowers = [];

  //Muse related var
  private BLEconnectionStatus: number = -1;
  winLength: number = 5;
  wincnt: number = 50;
  wincounter = 0;
  closeBaselineCnt: number = 6;

  public winTimer: number = this.winLength;
  public winInterval: any;


  @ViewChild("lineCanvas1") lineCanvas1: ElementRef;
  private el: ElementRef

  constructor(
    private muse: MuseService,
    private ngZone: NgZone
  ) {
    // this.generateSample(); if no muse and directly try a reference sinusoid
  }

  ionViewDidEnter() {
    this.muse.connectionStatus.subscribe(
      (status) => {
        this.ngZone.run(() =>
          this.BLEconnectionStatus = status);
        if (status == 1) {
          this.onDeviceConnected();
        } else if (status == 0) {
          this.onDeviceDisconnected('');
        }
      }
    );
  }

  ionViewDidLeave() {
    this.disconnectMuse();
  }

  //MUSE functions start

  onDeviceConnected() {
    console.log('Device Connected');
    this.ngZone.run(() => {
      this.BLEconnectionStatus = 1;
    });
    this.eegSubscribe();
    this.muse.startNotifications();
  }

  eegSubscribe() {
    setTimeout(() => {
      this.muse.eegReadings.subscribe(
        (reading) => {
          try {
            // console.log('eegSubscribe');
            let idx = this.signal.length;
            if (reading.electrode == 1) {
              for (let i = 0; i < 12; i++) {
                this.dummy.push(0);
                this.cumSignal.push(Number(reading.samples[i].toFixed(2)));
                this.signal[idx + i] = reading.samples[i];
              }
            }
          } catch (error) {
            console.log('Muse reading Error')
          }
        }
      );
    }, 500);
  }

  onDeviceDisconnected(err) {
    console.log('Device Disconnected');

    this.ngZone.run(() => {
      this.BLEconnectionStatus = 0;
    });
  }

  disconnectMuse() {
    this.muse.ble.disconnect(null, this.muse.registeredID, null, null);
  }

  connectMuse() {
    this.muse.scan().subscribe();
  }

  startTimer() {
    this.signal = [];
    this.dummy = [];
    this.finalres = [];
    this.musestart();
    console.log(this.winTimer);
    this.winInterval = setInterval(() => {
      this.updateTimer();
    }, 1000);

  }

  async updateTimer() {
    if (this.winTimer > 0) {
      this.winTimer = this.winTimer - 1;
    }
    else {
      clearInterval(this.winInterval);
      this.wincounter += 1;
      await this.musestop();
      this.winTimer = this.winLength;
      setTimeout(() => this.startTimer(), 500);
    }
  }

  musestart() {
    setTimeout(async () => { await this.muse.start(); }, 500);
  }

  async musestop() {
    await this.muse.pause();
    this.calcDrowsiness();
  }


  //Muse functions end

  //// Drowsiness Calculation
  calcDrowsiness() {
    [this.resr, this.resi] = this.transform(this.signal, this.dummy);
    let intm;
    for (let i = 0; i < this.resi.length; i++) {
      intm = (Math.abs(this.resr[i]) + Math.abs(this.resi[i]))
      intm = (2 / this.resr.length) * intm;
      this.finalres.push(intm);
    }


    this.ngZone.run(() => {
      this.thetaBandPower = this.cumulateBandPower(this.thetaBand);
      this.alphaBandPower = this.cumulateBandPower(this.alphaBand);

      this.thetaBandPowers.push(this.thetaBandPower);
      this.alphaBandPowers.push(this.alphaBandPower);

      if (this.wincounter < this.closeBaselineCnt) {
        this.drowsinessFlag = 'Baselining';
      }
      else if (this.wincounter == this.closeBaselineCnt) {
        this.drowsinessThreshold[0] = this.average(this.thetaBandPowers);
        this.drowsinessThreshold[1] = this.average(this.alphaBandPowers);
      }
      else {
        if ((this.thetaBandPower <= this.drowsinessThreshold[0]) || (this.alphaBandPower <= this.drowsinessThreshold[1])) {
          this.drowsinessFlag = 'True';
        }
        else {
          this.drowsinessFlag = 'False';
        }
      }
    });

    // this.saveEEGToCSV(this.finalres);
  }

  stopTimer() {
    this.muse.stopNotifications()
    console.log(this.thetaBandPowers + '=' + this.alphaBandPowers);
    // console.log("" + this.cumSignal);
  }

  average(myarr: number[]): number {
    let tmp = 0;
    for (let i = 0; i < myarr.length; i++) {
      tmp += myarr[i];
    }
    tmp = tmp / myarr.length;
    return tmp
  }

  cumulateBandPower(band: number[]): number {
    let bandPower = 0;
    let freqRes = EEG_FREQUENCY / (this.resi.length - 1);
    let startIdx = Math.round(1 + band[0] / freqRes);
    let endIdx = Math.round(1 + band[1] / freqRes);
    console.log("FreqRange: " + band[0] + ":" + band[1] + " indices = " + startIdx + ":" + endIdx);

    for (let index = startIdx; index < endIdx; index++) {
      bandPower += this.finalres[index];
    }

    return bandPower;
  }


  ////FFT related functions

  /* 
* Computes the discrete Fourier transform (DFT) of the given complex vector, storing the result back into the vector.
* The vector can have any length. This is a wrapper function.
*/
  transform(real: Array<number> | Float64Array, imag: Array<number> | Float64Array) {
    var resr, resi;
    const n: number = real.length;
    if (n != imag.length)
      throw "Mismatched lengths";
    if (n == 0)
      return;
    else if ((n & (n - 1)) == 0)  // Is power of 2
      [resr, resi] = this.transformRadix2(real, imag);
    else  // More complicated algorithm for arbitrary sizes
      [resr, resi] = this.transformBluestein(real, imag);
    return [resi, resr];
  }

  /* 
   * Computes the inverse discrete Fourier transform (IDFT) of the given complex vector, storing the result back into the vector.
   * The vector can have any length. This is a wrapper function. This transform does not perform scaling, so the inverse is not a true inverse.
   */
  inverseTransform(real: Array<number> | Float64Array, imag: Array<number> | Float64Array) {

    return this.transform(imag, real);
  }

  /* 
   * Computes the discrete Fourier transform (DFT) of the given complex vector, storing the result back into the vector.
   * The vector's length must be a power of 2. Uses the Cooley-Tukey decimation-in-time radix-2 algorithm.
   */
  transformRadix2(real: Array<number> | Float64Array, imag: Array<number> | Float64Array) {
    // Length variables
    const n: number = real.length;
    if (n != imag.length)
      throw "Mismatched lengths";
    if (n == 1)  // Trivial transform
      return;
    let levels: number = -1;
    for (let i = 0; i < 32; i++) {
      if (1 << i == n)
        levels = i;  // Equal to log2(n)
    }
    if (levels == -1)
      throw "Length is not a power of 2";

    // Trigonometric tables
    let cosTable = new Array<number>(n / 2);
    let sinTable = new Array<number>(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cosTable[i] = Math.cos(2 * Math.PI * i / n);
      sinTable[i] = Math.sin(2 * Math.PI * i / n);
    }

    // Bit-reversed addressing permutation
    for (let i = 0; i < n; i++) {
      const j: number = reverseBits(i, levels);
      if (j > i) {
        let temp: number = real[i];
        real[i] = real[j];
        real[j] = temp;
        temp = imag[i];
        imag[i] = imag[j];
        imag[j] = temp;
      }
    }

    // Cooley-Tukey decimation-in-time radix-2 FFT
    for (let size = 2; size <= n; size *= 2) {
      const halfsize: number = size / 2;
      const tablestep: number = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + halfsize; j++, k += tablestep) {
          const l: number = j + halfsize;
          const tpre: number = real[l] * cosTable[k] + imag[l] * sinTable[k];
          const tpim: number = -real[l] * sinTable[k] + imag[l] * cosTable[k];
          real[l] = real[j] - tpre;
          imag[l] = imag[j] - tpim;
          real[j] += tpre;
          imag[j] += tpim;
        }
      }
    }
    return [real, imag];
    // Returns the integer whose value is the reverse of the lowest 'width' bits of the integer 'val'.
    function reverseBits(val: number, width: number): number {
      let result: number = 0;
      for (let i = 0; i < width; i++) {
        result = (result << 1) | (val & 1);
        val >>>= 1;
      }
      return result;
    }
  }

  /* 
   * Computes the discrete Fourier transform (DFT) of the given complex vector, storing the result back into the vector.
   * The vector can have any length. This requires the convolution function, which in turn requires the radix-2 FFT function.
   * Uses Bluestein's chirp z-transform algorithm.
   */
  transformBluestein(real: Array<number> | Float64Array, imag: Array<number> | Float64Array) {
    // Find a power-of-2 convolution length m such that m >= n * 2 + 1
    const n: number = real.length;
    if (n != imag.length)
      throw "Mismatched lengths";
    let m: number = 1;
    while (m < n * 2 + 1)
      m *= 2;

    // Trigonometric tables
    let cosTable = new Array<number>(n);
    let sinTable = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const j: number = i * i % (n * 2);  // This is more accurate than j = i * i
      cosTable[i] = Math.cos(Math.PI * j / n);
      sinTable[i] = Math.sin(Math.PI * j / n);
    }

    // Temporary vectors and preprocessing
    let areal: Array<number> = this.newArrayOfZeros(m);
    let aimag: Array<number> = this.newArrayOfZeros(m);
    for (let i = 0; i < n; i++) {
      areal[i] = real[i] * cosTable[i] + imag[i] * sinTable[i];
      aimag[i] = -real[i] * sinTable[i] + imag[i] * cosTable[i];
    }
    let breal: Array<number> = this.newArrayOfZeros(m);
    let bimag: Array<number> = this.newArrayOfZeros(m);
    breal[0] = cosTable[0];
    bimag[0] = sinTable[0];
    for (let i = 1; i < n; i++) {
      breal[i] = breal[m - i] = cosTable[i];
      bimag[i] = bimag[m - i] = sinTable[i];
    }

    // Convolution
    let creal = new Array<number>(m);
    let cimag = new Array<number>(m);

    let cr, ci: any;
    [cr, ci] = this.convolveComplex(areal, aimag, breal, bimag, creal, cimag);

    // Postprocessing
    for (let i = 0; i < n; i++) {
      real[i] = cr[i] * cosTable[i] + ci[i] * sinTable[i];
      imag[i] = -cr[i] * sinTable[i] + ci[i] * cosTable[i];
    }
    return [real, imag];
  }

  /* 
   * Computes the circular convolution of the given real vectors. Each vector's length must be the same.
   */
  convolveReal(xvec: Array<number> | Float64Array, yvec: Array<number> | Float64Array, outvec: Array<number> | Float64Array): void {
    const n: number = xvec.length;
    if (n != yvec.length || n != outvec.length)
      throw "Mismatched lengths";
    this.convolveComplex(xvec, this.newArrayOfZeros(n), yvec, this.newArrayOfZeros(n), outvec, this.newArrayOfZeros(n));
  }

  /* 
   * Computes the circular convolution of the given complex vectors. Each vector's length must be the same.
   */
  convolveComplex(
    xreal: Array<number> | Float64Array, ximag: Array<number> | Float64Array,
    yreal: Array<number> | Float64Array, yimag: Array<number> | Float64Array,
    outreal: Array<number> | Float64Array, outimag: Array<number> | Float64Array) {

    const n: number = xreal.length;
    if (n != ximag.length || n != yreal.length || n != yimag.length
      || n != outreal.length || n != outimag.length)
      throw "Mismatched lengths";

    xreal = xreal.slice();
    ximag = ximag.slice();
    yreal = yreal.slice();
    yimag = yimag.slice();
    this.transform(xreal, ximag);
    this.transform(yreal, yimag);

    for (let i = 0; i < n; i++) {
      const temp: number = xreal[i] * yreal[i] - ximag[i] * yimag[i];
      ximag[i] = ximag[i] * yreal[i] + xreal[i] * yimag[i];
      xreal[i] = temp;
    }
    this.inverseTransform(xreal, ximag);

    for (let i = 0; i < n; i++) {  // Scaling (because this FFT implementation omits it)
      outreal[i] = xreal[i] / n;
      outimag[i] = ximag[i] / n;
    }
    return [outreal, outimag];
  }


  newArrayOfZeros(n: number): Array<number> {
    let result: Array<number> = [];
    for (let i = 0; i < n; i++)
      result.push(0);
    return result;
  }


  //// Reference Signal Generation
  generateSample() {
    let f1 = 5;
    let f2 = 10;
    let f3 = 25;
    let T = 10;
    let i = 0;
    let k = 0;
    while (i <= T) {
      this.times.push(k);
      var s1 = Math.sin(2 * Math.PI * f1 * i);
      var s2 = Math.sin(2 * Math.PI * f2 * i);
      var s3 = Math.sin(2 * Math.PI * f3 * i);
      var s4 = s1 + s2 + s3;
      this.signal.push(s4);
      this.dummy.push(0);
      i += SAMPLING_PERIOD;
      k += 1;
    }
    this.times = this.times.splice(0, this.times.length / 2);
    console.log('Transformed');
    [this.resr, this.resi] = this.transform(this.signal, this.dummy);
    console.log('RES-REAL' + this.resr);
    console.log('RES-IMAG' + this.resi);
    let intm;
    for (let i = 0; i < this.resi.length / 2; i++) {
      intm = (Math.abs(this.resr[i]) + Math.abs(this.resi[i]))

      intm = (2 / this.resr.length) * intm;
      this.finalres.push(intm);
    }
    console.log('FInal' + this.finalres);

  }


  async saveEEGToCSV(samples: number[] | Float64Array) {
    const headers = 'current';
    const csvData = headers + '\n' + this.finalres.join('\n');
    document.getElementById('txt').innerHTML = csvData;
    var textToSave = document.getElementById('txt').innerHTML;
    var hiddenElement = document.createElement('a');

    hiddenElement.href = 'data:attachment/csv,' + encodeURI(textToSave);
    hiddenElement.target = '_blank';
    hiddenElement.download = 'win' + this.wincounter + '.csv';
    hiddenElement.click();

  }

}

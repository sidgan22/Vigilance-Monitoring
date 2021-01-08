import { Component, ElementRef, ViewChild } from '@angular/core';
import { FilesystemDirectory, FilesystemEncoding } from '@capacitor/core';
import { Filesystem } from '@capacitor/core/dist/esm/web/filesystem';
import { HighchartsChartModule, HighchartsChartComponent } from 'highcharts-angular';
import * as Highcharts from 'highcharts';
import { Chart } from 'chart.js';
import 'chartjs-plugin-zoom';
import { generate } from 'rxjs';
import { ThrowStmt } from '@angular/compiler';
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  times: Array<number> = [];
  signal: Array<number> = [];
  sw1: Array<number> = [];
  sw2: Array<number> = [];
  dummy: Array<number> = [];

  ionViewDidEnter() {

    // this.lineChart1 = new Chart(this.lineCanvas1.nativeElement, {

    //   type: "line",
    //   options: {
    //     zoom: {
    //       enabled: true,
    //       drag: false,
    //       mode: "xy",
    //       limits: {
    //         max: 10,
    //         min: 0.5
    //       }
    //     }
    //   },
    //   data: {
    //     labels: this.times,
    //     datasets: [
    //       {
    //         label: "My First dataset",
    //         fill: false,
    //         lineTension: 0.1,
    //         backgroundColor: "rgba(75,192,192,0.4)",
    //         borderColor: "rgba(75,192,192,1)",
    //         borderCapStyle: "butt",
    //         borderDash: [],
    //         borderDashOffset: 0.0,
    //         borderJoinStyle: "miter",
    //         pointBorderColor: "rgba(75,192,192,1)",
    //         pointBackgroundColor: "#fff",
    //         pointBorderWidth: 1,
    //         pointHoverRadius: 5,
    //         pointHoverBackgroundColor: "rgba(75,192,192,1)",
    //         pointHoverBorderColor: "rgba(220,220,220,1)",
    //         pointHoverBorderWidth: 2,
    //         pointRadius: 1,
    //         pointHitRadius: 10,
    //         data: this.sw1,
    //         spanGaps: false,
    //       }
    //     ]
    //   }
    // });
    // this.lineChart2 = new Chart(this.lineCanvas2.nativeElement, {

    //   type: "line",
    //   options: {
    //     zoom: {
    //       enabled: true,
    //       drag: false,
    //       mode: "xy",
    //       limits: {
    //         max: 10,
    //         min: 0.5
    //       }
    //     }
    //   },
    //   data: {
    //     labels: this.times,
    //     datasets: [
    //       {
    //         fill: false,
    //         lineTension: 0.1,
    //         backgroundColor: "rgba(75,192,192,0.4)",
    //         borderColor: "rgba(75,192,192,1)",
    //         borderCapStyle: "butt",
    //         borderDash: [],
    //         borderDashOffset: 0.0,
    //         borderJoinStyle: "miter",
    //         pointBorderColor: "rgba(75,192,192,1)",
    //         pointBackgroundColor: "#fff",
    //         pointBorderWidth: 1,
    //         pointHoverRadius: 5,
    //         pointHoverBackgroundColor: "rgba(75,192,192,1)",
    //         pointHoverBorderColor: "rgba(220,220,220,1)",
    //         pointHoverBorderWidth: 2,
    //         pointRadius: 1,
    //         pointHitRadius: 10,
    //         data: this.sw2,
    //         spanGaps: false,
    //       }
    //     ]
    //   }
    // });
  }
  // Data
  @ViewChild("lineCanvas1") lineCanvas1: ElementRef;

  @ViewChild("lineCanvas2") lineCanvas2: ElementRef;

  private lineChart1: Chart;
  private lineChart2: Chart;
  resi: number[];
  resr: number[];
  constructor() {
    this.generateSample();
  }

  generateSample() {
    let f1 = 5;
    let f2 = 10;

    let t = 0.004;
    let T = 30;
    let i = 0;
    while (i <= 10) {
      this.times.push(i);
      var s1 = Math.sin(2 * Math.PI * f1 * i);
      var s2 = Math.sin(2 * Math.PI * f2 * i);
      var s3 = s1 + s2;
      this.sw1.push(s1);
      this.sw2.push(s2);
      this.signal.push(s3);
      this.dummy.push(0);
      console.log(s1, s2, s3);
      i += t;
    }
    console.log('SW1');
    console.log(this.sw1);

    console.log('SW2');
    console.log(this.sw2);

    console.log('Transformed')
    console.log("Arr Length:" + this.signal.length +
      "\nLast element" + this.signal[this.signal.length - 1]);

    [this.resr, this.resi] = this.transform(this.signal, this.dummy);
    console.log('RES-REAL' + this.resr);
  }
  transform(real: Array<number> | Float64Array, imag: Array<number> | Float64Array) {
    var resr, resi;

    console.log('Entered Transform');
    const n: number = real.length;
    if (n != imag.length)
      throw "Mismatched lengths";
    if (n == 0)
      return;
    else if ((n & (n - 1)) == 0)  // Is power of 2
      [resr, resi] = this.transformRadix2(real, imag);
    else  // More complicated algorithm for arbitrary sizes
      [resr, resi] = this.transformBluestein(real, imag);
    return [resr, resi];
  }


  /* 
   * Computes the inverse discrete Fourier transform (IDFT) of the given complex vector, storing the result back into the vector.
   * The vector can have any length. This is a wrapper function. This transform does not perform scaling, so the inverse is not a true inverse.
   */
  inverseTransform(real: Array<number> | Float64Array, imag: Array<number> | Float64Array) {
    var resr, resi;
    console.log('Entered invTransform');
    [resr, resi] = this.transform(imag, real);
    return [resr, resi];
  }


  /* 
   * Computes the discrete Fourier transform (DFT) of the given complex vector, storing the result back into the vector.
   * The vector's length must be a power of 2. Uses the Cooley-Tukey decimation-in-time radix-2 algorithm.
   */
  transformRadix2(real: Array<number> | Float64Array, imag: Array<number> | Float64Array) {
    console.log('Entered Radix2');
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
    console.log('Entered BLSTEIN');
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
    this.convolveComplex(areal, aimag, breal, bimag, creal, cimag);

    // Postprocessing
    for (let i = 0; i < n; i++) {
      real[i] = creal[i] * cosTable[i] + cimag[i] * sinTable[i];
      imag[i] = -creal[i] * sinTable[i] + cimag[i] * cosTable[i];
    }
    return [real, imag];
  }


  /* 
   * Computes the circular convolution of the given real vectors. Each vector's length must be the same.
   */
  convolveReal(xvec: Array<number> | Float64Array, yvec: Array<number> | Float64Array, outvec: Array<number> | Float64Array) {
    var resr, resi;
    console.log('Entered convReal');
    const n: number = xvec.length;
    if (n != yvec.length || n != outvec.length)
      throw "Mismatched lengths";
    [resr, resi] = this.convolveComplex(xvec, this.newArrayOfZeros(n), yvec, this.newArrayOfZeros(n), outvec, this.newArrayOfZeros(n));
    return [resr, resi];
  }


  /* 
   * Computes the circular convolution of the given complex vectors. Each vector's length must be the same.
   */
  convolveComplex(
    xreal: Array<number> | Float64Array, ximag: Array<number> | Float64Array,
    yreal: Array<number> | Float64Array, yimag: Array<number> | Float64Array,
    outreal: Array<number> | Float64Array, outimag: Array<number> | Float64Array) {
    console.log('Entered convComplex');
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
    [xreal, ximag] = this.inverseTransform(xreal, ximag);

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
  async saveTESToCSV(samples: number[] | Float64Array) {
    let filename = 'FFT' + '.csv';

    const headers = 'current';
    const csvData = headers + '\n' + samples.join('\n');

    Filesystem.writeFile({
      path: filename,
      data: csvData,
      directory: FilesystemDirectory.Documents,
      encoding: FilesystemEncoding.UTF8
    }).then(
      () => {
        console.log('Completed Save');
      }
    );
  }

}

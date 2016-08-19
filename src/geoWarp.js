import {geoPath, geoProjection} from "d3-geo";
import {default as gdalBand} from './gdal';

var NBANDS = 4; // RGBA
var SPHERE = {type: "Sphere"};

function clamp(val, min, max) {
  if (min > max) {
    throw 'min > max'
  }
  return Math.max(min, Math.min(val, max));
}


export default function() {
  var srcProj = null,
      dstProj = null,
      maskObject = null,
      chunkSize = [256, 256],
      createCanvas,
      maskCanvas,
      maskContext,
      src,
      dst;

  // Let's work internally with a Canvas/PNG. So support for up to 4 bands.
  // Fill background with black.
  // 
  // If 4 layers in output, assume RGBA

  // Warp a block:
  // Draw masking object.
  // List all points inside masking object, dstPoints.
  // Back-project dstPoints -> srcPoints.
  // If output has less than 4 bands, now fill canvas with black.
  // Interpolate:
  //  * Ask source ds for values as needed (for all bands at once).
  //  * Create new pixel values (for all bands at once).
  // Write block to destination dataset.

  // Dataset API:
  // const NBANDS = 4
  // size -> [width, height]
  // bandCount -> integer
  // blockSize -> [blockWidth, blockHeight]
  // readBlock(X, Y) -> a blockSize.x * blockSize.y * NBANDS Uint8ClampedArray
  // writeBlock(X, Y) -> a blockSize.x * blockSize.y * NBANDS Uint8ClampedArray
  // For both readBlock and writeBlock, the ds should only care about the
  // bandCount first values of each pixel. So the other values can be anything.
  
  // Inside warper?
  // readList(points) -> a points.length * bandCount Uint8ClampedArray
  // createMask(x0, y0, w, h) -> w * h * NBANDS Uint8ClampedArray

  function warpBlock(X, Y) {
    var bs = dst.bands.get(1).blockSize,
        w = bs.x,
        h = bs.y,        
        x0 = X * w,
        y0 = Y * h;

    var dstImgData = createMask(x0, y0, w, h);

    // First used for destination points, then source points
    var maxNumPoints = w * h;
    var points = new Float64Array(2 * maxNumPoints);
    var dstIndices = new Uint32Array(maxNumPoints);
    var numPoints = 0;
    var point;
    for (var i = 0; i < maxNumPoints; i++) {
      if (dstImgData[NBANDS * (i + 1) - 1]) { // if alpha component nonzero
        point = [
          i % w + x0 + 0.5,
          Math.floor(i / w) + y0 + 0.5
        ];

        point = srcProj(dstProj.invert(point));

        points[2 * numPoints] = point[0];
        points[2 * numPoints + 1] = point[1];
        dstIndices[numPoints] = i;
        numPoints++;
      }
    }
    if (numPoints === 0) return;
    // console.log('numPoints', numPoints)

    dstImgData.fill(0); // fill with transparent black

    points = points.subarray(0, 2 * numPoints);
    dstIndices = dstIndices.subarray(0, numPoints);

    interpolate(points, dstIndices, dstImgData);

    // temp, GDAL-specific write
    for (var j = 0; j < dst.bands.count(); j++) {
      var band = dst.bands.get(j+1);
      var pixels = band.pixels;
      var dstChunk = pixels.readBlock(X, Y);
      for (var i = 0; i < w * h; i++) {
        dstChunk[i] = dstImgData[NBANDS * i + j];
      }
      band.pixels.writeBlock(X, Y, dstChunk);
    }
  }

  function interpolate(srcPoints, dstIndices, dstData) {
    var rasterSize = [src.rasterSize.x, src.rasterSize.y];
    for (var i = 0; i < srcPoints.length; i++) {
      // Nearest neighbor interpolation
      srcPoints[i] = clamp(Math.round(srcPoints[i]), 0, rasterSize[i % 2] - 1);
    }
    writeList(src, srcPoints, dstData, dstIndices);
  }

  // gdal-specific
  function writeList(src, srcPoints, dstData, dstIndices) {
    var bs = src.bands.get(1).blockSize,
        w = bs.x,
        h = bs.y,
        bandCount = src.bands.count();

    // console.log('writing list', w, h, bandCount)

    var blockCoords = new Array(dstIndices.length);
    var x, y, X, Y, dx, dy, srcStartIdx, dstStartIdx, i;
    for (i = 0; i < blockCoords.length; i++) {
      x = Math.round(srcPoints[2 * i]);
      y = Math.round(srcPoints[2 * i + 1]);
      X = Math.floor(x / w);
      Y = Math.floor(y / h);
      dx = x - X * w;
      dy = y - Y * h;
      srcStartIdx = (dy * w + dx);
      dstStartIdx = NBANDS * dstIndices[i];
      blockCoords[i] = [X, Y, srcStartIdx, dstStartIdx];
    }
    
    blockCoords.sort(function(bc1, bc2) {
      return 2 * Math.sign(bc1[0] - bc2[0]) + Math.sign(bc1[1] - bc2[1]);
    });

    var srcData = new Uint8ClampedArray(dstIndices.length * NBANDS);

    var lastX, lastY, bc, j;
    var srcBandsData = new Array();
    for (j = 0; j < bandCount; j++) {
      srcBandsData.push(new Uint8Array(w * h));
    }
    for (i = 0; i < blockCoords.length; i++) {
      bc = blockCoords[i];
      X = bc[0];
      Y = bc[1];

      // if (bc[0] < lastX) console.log('bc0 < lastX', bc[0], lastX);
      // if (bc[1] < lastY && lastX == bc[0]) console.log('bc1 < lastY', bc[1], lastY);
      if (bc[0] !== lastX || bc[1] !== lastY) {
        for (j = 0; j < bandCount; j++) {
          src.bands.get(j+1).pixels.readBlock(bc[0], bc[1], srcBandsData[j]);
        }
      }

      srcStartIdx = bc[2];
      dstStartIdx = bc[3];

      for (j = 0; j < bandCount; j++) {
        dstData[dstStartIdx + j] = srcBandsData[j][srcStartIdx];
      }

      lastX = X;
      lastY = Y;
    }
  }

  function createMask(x0, y0, w, h) {
    // Temporarily translate the dstProjection
    var translate0 = dstProj.translate();
    dstProj.translate([translate0[0] - x0, translate0[1] - y0]);
    
    maskContext.clearRect(0, 0, w, h);
    maskContext.beginPath();
    geoPath().projection(dstProj).context(maskContext)(maskObject);
    maskContext.closePath();
    maskContext.fill();
    
    dstProj.translate(translate0);
    
    return maskContext.getImageData(0, 0, w, h).data;
  }
  function alphaZero(img, dx, dy) {

    var linearCoords = (dy * chunkSize.x + dx) * NUM_MAS + 3;
    return img.data[linearCoords] === 0;
  }

  // function warpChunk(x0, y0, x1, y1) {
  //   var dstImg = maskedImg(x0, y0, x1, y1);
  //   var dstChunk;

  //   var dstPoints = [],
  //       srcPoints = [];

  //   for (var x = x0; x < x1; x++) {
  //     for (var y = y0; y < y1; y++) {
  //       if (!alphaZero(dstImg, x-x0, y-y0)) {
  //         // Invert middle of pixel coordinate
  //         dstPoints.push([x + 0.5, y + 0.5]);
  //       }
  //     }
  //   }

  //   srcPoints = dstPoints.map(function(dstPoint) {
  //     return srcProj(dstProj.invert(dstPoint));
  //   });

  //   dst.bands.forEach(function(band, i) {
  //     var pxnum;
  //     var srcBandReader = gdalBand(src.bands.get(i));
  //     dstChunk = band.pixels.read(x0, y0, x1 - x0, y1 - y0);
  //     var dstImgData = dstImg.data;
  //     var values = interpolate(srcBandReader, srcPoints);
  //     values.forEach(function(value, j) {
  //       if (i == 4) return;
  //       var dstPoint = dstPoints[j];
  //       var idx = i - 1 + NUM_MAS * (
  //         Math.floor(dstPoint[1] - y0) * (x1 - x0)
  //         + Math.floor(dstPoint[0]) - x0);
  //       if (dstImgData[idx+NUM_MAS-i] === 0) value = 0;
  //       dstImgData[idx] = value;
  //     });
  //     for (pxnum=0; pxnum < (x1-x0) * (y1-y0); pxnum++) {
  //       dstChunk[pxnum] = dstImgData[pxnum * NUM_MAS + i - 1];
  //     }
  //     band.pixels.write(x0, y0, x1 - x0, y1 - y0, dstChunk);
  //   });
  // }

  function warp(bbox) {

    var bs = dst.bands.get(1).blockSize;
    chunkSize = [bs.x, bs.y]
    maskCanvas = createCanvas(chunkSize[0], chunkSize[1]);
    maskContext = maskCanvas.getContext('2d');
    maskContext.fillStyle = '#fff';

    if (typeof(bbox) === 'undefined') {
      bbox = {
        x0: 0,
        x1: dst.rasterSize.x,
        y0: 0,
        y1: dst.rasterSize.y
      };
    }

    for (var X = 0; X < bbox.x1 / chunkSize[0]; X++) {
      for (var Y = 0; Y < bbox.y1 / chunkSize[1]; Y++) {
        warpBlock(X, Y);
      }
    }
  }

  warp.dstProj = function(_) {
    return arguments.length ? (dstProj = _, warp) : dstProj;
  };

  warp.srcProj = function(_) {
    return arguments.length ? (srcProj = _, warp) : srcProj;
  };

  warp.dst = function(_) {
    return arguments.length ? (dst = _, warp) : dst;
  };

  warp.src = function(_) {
    return arguments.length ? (src = _, warp) : src;
  };

  warp.chunkSize = function(_) {
    return arguments.length ? (chunkSize = _, warp) : chunkSize;
  };

  warp.maskObject = function(_) {
    return arguments.length ? (maskObject = _, warp) : maskObject;
  };

  warp.createCanvas = function(_) {
    return arguments.length ? (createCanvas = _, warp) : createCanvas;
  };

  return warp.maskObject(SPHERE);
}

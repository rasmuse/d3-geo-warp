import {default as gdal} from 'gdal';

function blockSortFunction(block) {
  return -block.lastAccess;
}

function rasterBand(band) {
  var blockSize = band.blockSize;

  var self = {};

  self.size = band.size;

  function getBlock(x, y) {
    return band.pixels.readBlock(x, y);
  }

  function getBlockCoords(x, y) {
    var coords = {
      x: Math.floor(x / blockSize.x),
      y: Math.floor(y / blockSize.y)
    }

    var x0 = coords.x * blockSize.x;
    var y0 = coords.y * blockSize.y;

    // dx, dy are relative coordinates within the block
    var dx = x - x0,
        dy = y - y0,
        blockIdx = dy * blockSize.x + dx;

    coords.i = blockIdx;

    return coords;
  }

  function get(x, y) {
    var bc = getBlockCoords(x, y);
    var data = getBlock(bc.x, bc.y);
    return data[bc.i];
  }

  function getList(points) {

    var blockCoords = points.map(function(point, i) {
      var X = Math.floor(point[0] / blockSize.x);
      var Y = Math.floor(point[1] / blockSize.y);
      var x0 = X * blockSize.x;
      var y0 = Y * blockSize.y;

      return [
        X,
        Y,
        (point[1] - y0) * blockSize.x + (point[0] - x0),
        i
      ];
    });

    blockCoords.sort(function(bc1, bc2) {
      return 2 * Math.sign(bc1[0] - bc2[0]) + Math.sign(bc1[1] - bc2[1]);
    });

    var X, Y, data, bc, lastX, lastY;

    var values = new Array(points.length);

    for (var i = 0; i < blockCoords.length; i++) {
      bc = blockCoords[i];
      X = bc[0];
      Y = bc[1];
      if (X !== lastX || Y !== lastY) {
        data = getBlock(X, Y);
      }
      values[bc[3]] = data[bc[2]];
      lastX = X;
      lastY = Y;
    }

    return values;
  }

  self.pixels = {get: get, getList: getList};

  self.getBlockCoords = getBlockCoords;

  return self;
}

export default rasterBand;

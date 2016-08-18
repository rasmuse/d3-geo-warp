import {default as gdal} from 'gdal';

function blockSortFunction(block) {
  return -block.lastAccess;
}

function rasterBand(band) {
  var blockSize = band.blockSize;
  var blocks = [];
  var maxElements = 1e6;
  var maxBlocks = maxElements / (blockSize.x * blockSize.y);

  var self = {};

  self.size = band.size;

  function getBlock(x, y) {
    var block;
    blocks.sort(blockSortFunction);
    block = blocks.find(function(b) {
      return (b.x == x && b.y == y);
    });
    if (typeof(block) === 'undefined') {
      block = {
        x: x,
        y: y,
        data: band.pixels.readBlock(x, y)
      };
      if (blocks.unshift(block) > maxBlocks) {
        var throwOut = blocks[blocks.length - 1];
        blocks.pop();
      }
    }
    block.lastAccess = Date.now();
    return block;
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
    var block = getBlock(bc.x, bc.y);
    return block.data[bc.i];
  }

  self.pixels = {get: get};

  self.getBlockCoords = getBlockCoords;

  return self;
}

export default rasterBand;

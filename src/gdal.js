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

  function getList(points) {

    var srcBlocks = new Map();
    var values = new Array(points.length);
    points.forEach(function(point, idx) {
      var blockCoords = getBlockCoords(point[0], point[1]);
      var id = JSON.stringify([blockCoords.x, blockCoords.y]);
      if (!srcBlocks.has(id)) {
        srcBlocks.set(id, {
          x: blockCoords.x,
          y: blockCoords.y,
          order: [],
          blockIndices: []
        });
      }
      var srcBlock = srcBlocks.get(id);
      srcBlock.order.push(idx);
      srcBlock.blockIndices.push(blockCoords.i);
    });

    srcBlocks.forEach(function(srcBlock) {
      var block = getBlock(srcBlock.x, srcBlock.y);
      var data = block.data;
      var blockIndices = srcBlock.blockIndices;
      var order = srcBlock.order;
      for (var i = blockIndices.length - 1; i >= 0; i--) {
        values[order[i]] = data[blockIndices[i]];
      }
    });

    return values;
  }

  self.pixels = {get: get, getList: getList};

  self.getBlockCoords = getBlockCoords;

  return self;
}

export default rasterBand;

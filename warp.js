var NUM_COMPONENTS = 4; // RGBA

function linearCoords(img, col, row) {
    return (row * img.width + col) * NUM_COMPONENTS;
}

function setPixel(img, col, row, val) {
    var ix0 = linearCoords(img, col, row);
    val.forEach(function (component, di) {
        img.data[ix0 + di] = component;
    });
    // console.log('set pixel', row, col, ' = ', val, getPixel(img, row, col));
}

function clamp(val, min, max) {
    if (min > max) {
        throw 'min > max'
    }
    return Math.max(min, Math.min(val, max));
}

function getPixel(raster, col, row) {
    var ix0 = linearCoords(raster, col, row);
    return raster.data.slice(ix0, ix0 + NUM_COMPONENTS);
}

function isAlphaZero(raster, col, row) {
    return (raster.data[linearCoords(raster, col, row) + 3] == 0);
}

function interpolate(raster, point) {
    var x = point[0];
    var y = point[1];
    var col = clamp(Math.round(x), 0, raster.width-1);
    var row = clamp(Math.round(y), 0, raster.height-1);
    return getPixel(raster, col, row);
}

function warpInImage(raster, inverseProjection, image, maskFunction) {
    for (var row = 0; row < image.height; row++) {
        for (var col = 0; col < image.width; col++) {
            if (maskFunction(col, row)) {
                continue;
            }

            projectedPoint = [col+0.5, row+0.5];
            inversePoint = inverseProjection(projectedPoint);
            setPixel(image, col, row, interpolate(raster, inversePoint));
        }
    }
    return image;
}

function warp(raster, inverseProjection, context, maskFunction) {
    var image = context.getImageData(
        0,
        0,
        context.canvas.width,
        context.canvas.height);

    return warpInImage(raster, inverseProjection, image, maskFunction);
}

exports.isAlphaZero = isAlphaZero;
exports.warpInImage = warpInImage;
exports.warp = warp;
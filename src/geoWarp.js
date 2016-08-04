import {geoPath} from "d3-geo";

var NUM_COMPONENTS = 4; // RGBA
var SPHERE = {type: "Sphere"};

function linearCoords(img, col, row) {
    return (row * img.width + col) * NUM_COMPONENTS;
}

function setPixel(img, col, row, val) {
    var ix0 = linearCoords(img, col, row);
    val.forEach(function (component, di) {
        img.data[ix0 + di] = component;
    });
}

function clamp(val, min, max) {
    if (min > max) {
        throw 'min > max'
    }
    return Math.max(min, Math.min(val, max));
}

function getPixel(imageData, col, row) {
    var ix0 = linearCoords(imageData, col, row);
    return imageData.data.slice(ix0, ix0 + NUM_COMPONENTS);
}

function isAlphaZero(imageData, col, row) {
    return (imageData.data[linearCoords(imageData, col, row) + 3] == 0);
}

function interpolate(imageData, point) {
    var x = point[0];
    var y = point[1];
    var col = clamp(Math.round(x), 0, imageData.width-1);
    var row = clamp(Math.round(y), 0, imageData.height-1);
    return getPixel(imageData, col, row);
}

export default function() {
    var srcProj, dstProj,
        dstContext, dstCanvas,
        maskObject;

    function createCanvas(width, height) {
        var canvas = document.createElement('canvas');
        if (typeof width !== 'undefined') canvas.width = width;
        if (typeof height !== 'undefined') canvas.height = height;
        return canvas;
    }

    function warp(srcImage) {
        var srcCanvas = createCanvas(srcImage.width, srcImage.height),
            srcContext = srcCanvas.getContext('2d'),
            maskData = makeMask();

        srcContext.drawImage(srcImage, 0, 0);
        srcImage = srcContext.getImageData(
            0, 0, srcCanvas.width, srcCanvas.height);

        var inverseProjection = function (point) {
            return srcProj(dstProj.invert(point));
        }

        var dstImage = dstContext.getImageData(0, 0, dstCanvas.width, dstCanvas.height);

        for (var row = 0; row < dstImage.height; row++) {
            for (var col = 0; col < dstImage.width; col++) {
                if (isAlphaZero(maskData, col, row)) continue;

                var projectedPoint = [col+0.5, row+0.5],
                    inversePoint = inverseProjection(projectedPoint);
                setPixel(dstImage, col, row, interpolate(srcImage, inversePoint));
            }
        }

        dstContext.putImageData(dstImage, 0, 0);
    }

    warp.dstProj = function(_) {
        if (!arguments.length) return dstProj;
        dstProj = _;
        return warp;
    };

    warp.srcProj = function(_) {
        if (!arguments.length) return srcProj;
        srcProj = _;
        return warp;
    };

    warp.dstContext = function(_) {
        if (!arguments.length) return dstContext;
        dstContext = _;
        dstCanvas = dstContext.canvas;
        return warp;
    };

    function makeMask() {
        var width = dstCanvas.width,
            height = dstCanvas.height,
            maskCanvas = createCanvas(),
            context = maskCanvas.getContext('2d');

        maskCanvas.width = width;
        maskCanvas.height = height;

        context.beginPath();
        context.fillStyle = '#fff';
        geoPath().projection(dstProj).context(context)(maskObject);
        context.closePath();
        context.fill();

        return context.getImageData(0, 0, width, height);
    }

    warp.maskObject = function (_) {
        if (!arguments.length) return maskObject;
        maskObject = _;
        return warp;
    }

    warp.createCanvas = function (_) {
        if (!arguments.length) return createCanvas;
        createCanvas = _;
        return warp;
    }

    return warp.maskObject(SPHERE);
}

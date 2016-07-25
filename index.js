var Canvas = require('canvas');

var width = 2000,
    height = 1500;
var canvas = new Canvas(width, height);
var context = canvas.getContext('2d');

var warp = require('./warp');

var d3 = require('d3-geo')

var world = {type: "Sphere"};

var fs = require('fs');
fs.readFile(__dirname + '/world.topo.bathy.200411.3x5400x2700.jpg', function(err, data){
    if (err) throw err;
    var img = new Canvas.Image();
    img.src = data;
    var tempContext = new Canvas(img.width, img.height).getContext('2d');
    tempContext.drawImage(img, 0, 0, img.width, img.height);
    var orig = tempContext.getImageData(0, 0, img.width, img.height)

    var srcProj = d3.geoEquirectangular()
        .fitSize([img.width, img.height], world);

    // var dstProj = d3.geoAzimuthalEqualArea()
    // var dstProj = d3.geoAzimuthalEquidistant().rotate([0,90])
    var dstProj = d3.geoConicEqualArea().rotate([120, 90, 50])
    // var dstProj = d3.geoOrthographic().rotate([180, 90])
    // var dstProj = d3.geoEquirectangular()
        .fitSize([width, height], world);

    var inverseProjection = function (point) { 
        return srcProj(dstProj.invert(point));
    }

    var maskCanvas = new Canvas(width, height);
    var maskContext = maskCanvas.getContext('2d');
    maskContext.beginPath()
    maskContext.fillStyle = '#fff'
    d3.geoPath().projection(dstProj).context(maskContext)(world);
    maskContext.closePath();
    maskContext.fill()

    var maskData = maskContext.getImageData(0, 0, width, height);

    var mf = function (x, y) {
        return warp.isAlphaZero(maskData, x, y);
    }

    var warped = warp.warp(orig, inverseProjection, context, mf);
    context.putImageData(warped, 0, 0);
    fs.writeFile('test.png', canvas.toBuffer());
});

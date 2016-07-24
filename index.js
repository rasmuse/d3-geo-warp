// var proj4 = require('proj4')
// // var d3 = require('d3', 'd3-geo-projection')
// // var d3g = require('d3-geo-projection')
// var d3 = require('d3')
// // d3.require("d3-geo-projection")
// var topojson = require('topojson')

// ssrs = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.017453292519943295]]'
// tsrs = "+proj=moll +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"

// // var rawProj = proj4('EPSG:54030');

// var projection = d3.geoProjection(function(x, y) {
//   // return [x/100000, y/100000]
//   return proj4(ssrs, tsrs, [x, y]);
//   // return [x, Math.log(Math.tan(Math.PI / 4 + y / 2))];
// });

// fs = require('fs')

// d3.json("http://localhost:8080/data/ne_110m_land/ne_110m_land.topojson", function(error, land) {
//   var f = topojson.feature(land, land.objects.ne_110m_land)

//   fs.writeFile('moll.geojson', JSON.stringify(f))
//   // path(topojson.feature(land, land.objects.ne_110m_land))
// })

var Canvas = require('canvas');

var width = 600,
    height = 500;
var canvas = new Canvas(width, height);
var context = canvas.getContext('2d');

console.log('Canvas width=' + canvas.width +', height=' + canvas.height);

var warp = require('./warp');

console.log(warp.drawWarped)

var d3 = require('d3-geo')

var grat = d3.geoGraticule()();

var projection = d3.geoEquirectangular().fitSize([width, height], grat);

function inverseProjection(point) {
    var col = point[0], row = point[1];
    var w = 300, h = 227;
    return [w * col / width, h * row / height];
}

// var path = d3.geoPath().projection(projection).context(context);

console.log(projection([0,0]));

var fs = require('fs');
fs.readFile(__dirname + '/rhino.jpg', function(err, data){
    if (err) throw err;
    var img = new Canvas.Image();
    img.src = data;
    var tempContext = new Canvas(img.width, img.height).getContext('2d');
    tempContext.drawImage(img, 0, 0, img.width, img.height);
    var orig = tempContext.getImageData(0, 0, img.width, img.height)
    var drawToImg = context.getImageData(0, 0, width, height);
    warp.warp(orig, inverseProjection, drawToImg);
    context.putImageData(drawToImg, 0, 0);
    fs.writeFile('test.png', canvas.toBuffer());
});

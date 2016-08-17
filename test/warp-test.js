const tape = require("tape"),
    d3_geo = require('d3-geo'),
    geoWarp = require("../"),
    gdal = require('gdal'),
    fs = require('fs'),
    os = require('os'),
    temp = require("temp").track(),
    path = require('path'),
    Canvas = require('canvas');

// tape("Warp something", function(test) {
//     var infile = __dirname + '/data/world.topo.bathy.200411.3x540x270.png',
//         expectedOutfile = __dirname + '/data/world.topo.bathy.200411.3x540x270.warped.png';

//     var Canvas = require('canvas');

//     var width = 300,
//         height = 200;

//     var canvas = new Canvas(width, height);
//     var context = canvas.getContext('2d');

//     var world = {type: "Sphere"};

//     fs.readFile(infile, function(err, data){
//         if (err) throw err;

//         var img = new Canvas.Image();
//         img.src = data;

//         var srcProj = d3_geo.geoEquirectangular()
//             .fitSize([img.width, img.height], world);

//         var dstProj = d3_geo.geoConicEqualArea().rotate([120, 90, 50])
//             .fitSize([width, height], world);

//         var warp = geoWarp().createCanvas(function(width, height) { return new Canvas(width, height); });

//         warp.dstProj(dstProj).srcProj(srcProj).dstContext(context);

//         warp(img);

//         var result = canvas.toBuffer().toString('binary');

//         fs.readFile(expectedOutfile, function(err, data) {
//             var expectedResult = data.toString('binary');
//             test.equal(result, expectedResult);
//         });

//     });
    
//     test.end();
// });

tape("Warp with GDAL", function(test) {
    var infile = __dirname + '/data/natearth.tif',
        expectedOutpath = __dirname + '/data/natearth-warped.tif';

    testOutpath = path.join(temp.mkdirSync(), 'test.tif');

    var width = 400,
        height = 200;

    var src = gdal.open(infile);
    var dst = gdal.open(testOutpath, 'w', ['GTiff'], width, height,
        src.bands.count(), gdal.GDT_Byte);

    var world = {type: 'Sphere'};
    var srcProj = d3_geo.geoEquirectangular()
        .fitSize([src.rasterSize.x, src.rasterSize.y], world);

    var dstProj = d3_geo.geoConicEqualArea().rotate([120, 90, 50])
        .fitSize([width, height], world);

    var warp = geoWarp()
        .src(src)
        .dst(dst)
        .srcProj(srcProj)
        .dstProj(dstProj)
        .createCanvas(function(width, height) {
            return new Canvas(width, height); 
        });

    warp();

    dst.close();

    var result = fs.readFileSync(testOutpath).toString('binary');
    var expectedResult = fs.readFileSync(expectedOutpath).toString('binary');
    test.equal(result, expectedResult);

    test.end();
});

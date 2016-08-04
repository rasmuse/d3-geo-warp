var tape = require("tape"),
    d3_geo = require('d3-geo'),
    d3_warp = require("../"),
    fs = require('fs');

tape("Warp something", function(test) {
    var infile = __dirname + '/data/world.topo.bathy.200411.3x540x270.png',
        expectedOutfile = __dirname + '/data/world.topo.bathy.200411.3x540x270.warped.png';

    var Canvas = require('canvas');

    var width = 300,
        height = 200;

    var canvas = new Canvas(width, height);
    var context = canvas.getContext('2d');

    var world = {type: "Sphere"};

    fs.readFile(infile, function(err, data){
        if (err) throw err;

        var img = new Canvas.Image();
        img.src = data;

        var srcProj = d3_geo.geoEquirectangular()
            .fitSize([img.width, img.height], world);

        var dstProj = d3_geo.geoConicEqualArea().rotate([120, 90, 50])
            .fitSize([width, height], world);

        var warp = d3_warp.geoWarp().createCanvas(function(width, height) { return new Canvas(width, height); });

        warp.dstProj(dstProj).srcProj(srcProj).dstContext(context);

        warp(img);

        var result = canvas.toBuffer().toString('binary');

        fs.readFile(expectedOutfile, function(err, data) {
            var expectedResult = data.toString('binary');
            test.equal(result, expectedResult);
        });

    });
    
    test.end();
});

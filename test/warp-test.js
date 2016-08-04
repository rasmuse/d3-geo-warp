var tape = require("tape"),
    d3_geo = require('d3-geo'),
    d3_warp = require("../");

tape("Warp something", function(test) {
    var Canvas = require('canvas');

    var width = 900,
        height = 900;

    var canvas = new Canvas(width, height);
    var context = canvas.getContext('2d');


    var world = {type: "Sphere"};

    var fs = require('fs');
    fs.readFile(__dirname + '/../world.topo.bathy.200411.3x5400x2700.jpg', function(err, data){
        if (err) throw err;
        var img = new Canvas.Image();
        img.src = data;
        var tempContext = new Canvas(img.width, img.height).getContext('2d');
        tempContext.drawImage(img, 0, 0, img.width, img.height);
        //var orig = tempContext.getImageData(0, 0, img.width, img.height)

        var srcProj = d3_geo.geoEquirectangular()
            .fitSize([img.width, img.height], world);

        var dstProj = d3_geo.geoAzimuthalEqualArea()
        // var dstProj = d3.geoAzimuthalEquidistant().rotate([0,90])
        // var dstProj = d3.geoConicEqualArea().rotate([120, 90, 50])
        // var dstProj = d3.geoOrthographic().rotate([180, 90])
        // var dstProj = d3.geoEquirectangular()
            .fitSize([width, height], world);

        var warp = d3_warp.geoWarp().createCanvas(function() {return new Canvas();});

        warp.dstProj(dstProj).srcProj(srcProj).dstContext(context);

        warp(tempContext);

        fs.writeFile('test.png', canvas.toBuffer());
    });
    
    test.end();
});

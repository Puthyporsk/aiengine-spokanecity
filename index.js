var map, dataSource, dataSource2, routeDataSource, routeDataSource2, routeLine, routeLine2, fromPin, toPin,
    geojson, geojson2, pathFinder, pathFinder2, vertices, vertices2, selectedMarker, originPin, counter = 0, colorcounter = 0, selectionLat = 0, selectionLong = 0;
var activatePath2;
var snappingTolerance = 1000; //Max distance from a line in meters in which a point will snap to.

//A flag indicating if paths should cross anti-meridian if it is shorter. If true, will calculate a mid-point between the coordinates that crosses the anti-meridian.
var crossAntiMeridian = true;

var geoJsonFiles = {
    '':'',
    'GIS_Conduit' : 'route-network/GIS_Conduit.geojson',
    'GIS_FiberCable' : 'route-network/GIS_FiberCable.geojson',
    'GIS_Street' : 'route-network/GIS_Street.geojson',
    'ssGravity Main' : 'route-network/WWM_ssGravityMain.geojson',
    'All Public Roads in WA (171MB)' : 'route-network/All_Roads_WA.geojson',
    'Roads in Spokane (1.65MB)' : 'route-network/Traffic_Flow.geojson',
    'Ipswich (5.9MB)': 'route-network/Ipswich-Road-Network.json',
    'Montreal (19.4MB)': 'route-network/montreal_roads.json',
    'Niagra Region (10.7MB)': 'route-network/niagra_roads.json',
    'San Diego Transit (3MB)': 'route-network/transit_routes_datasd.geojson',
    'Maritime trade routes (2.2MB)': 'route-network/maritime-trade-routes.geojson'
};

function GetMap() {

    //Initialize a map instance.
    map = new atlas.Map('myMap', {
        view: 'Auto',

        //Add your Azure Maps key to the map SDK. Get an Azure Maps key at https://azure.com/maps. NOTE: The primary key should be used as the key.
        authOptions: {
            authType: 'subscriptionKey',
            subscriptionKey: 'C0gsjhU5t6j0wokXSdyqGz5hVxp2qxOEUoNLFSP-sM4'
        }
    });

    //Wait until the map resources are ready.
    map.events.add('ready', function () {
        //Create a data source and add it to the map.
        dataSource = new atlas.source.DataSource();
        map.sources.add(dataSource);

        //teal colour to show the load file GIS
        map.layers.add(new atlas.layer.LineLayer(dataSource, null, {
            strokeColor: 'rgb(0, 200, 200)',
            strokeWidth: 3
        }), 'labels');

        dataSource2 = new atlas.source.DataSource();
        map.sources.add(dataSource2);

        map.layers.add(new atlas.layer.LineLayer(dataSource2, null, {
            strokeColor: 'purple',
            strokeWidth: 3
        }), 'labels');
        
        //Create a seperate data source for the route line and end points as these will be updated more frequently.
        routeDataSource = new atlas.source.DataSource();
        map.sources.add(routeDataSource);
        //path from Pin A to pin B
        map.layers.add(new atlas.layer.LineLayer(routeDataSource, null, {
            strokeColor: 'blue',
            strokeWidth: 5
        }), 'labels');
        
        
        routeDataSource2 = new atlas.source.DataSource();
        map.sources.add(routeDataSource2);
       
        map.layers.add(new atlas.layer.LineLayer(routeDataSource2, null, {
            strokeColor: 'red',
            strokeWidth: 5
        }), 'labels');


        //Create draggable HTML markers for the end points. They drag much smoother than symbols. 
        var fromImg = document.createElement('img');
        fromImg.src = 'img/startPin.png';
        fromImg.id = 'from';

        fromPin = new atlas.HtmlMarker({
            draggable: false,
            htmlContent: fromImg,
            position: [0, 0],
            pixelOffset: [0, 0],
            anchor: 'bottom-left'
        });

        fromImg.onmousedown = function () {
            selectedMarker = fromPin;
            counter++;
        };

        map.markers.add(fromPin);

        var toImg = document.createElement('img');
        toImg.src = 'img/endPin.png';
        toImg.id = 'to';        

        toPin = new atlas.HtmlMarker({
            draggable: false,
            htmlContent: toImg,
            position: [0, 0],
            pixelOffset: [0, 0],
            anchor: 'bottom-left'
        });

        toImg.onmousedown = function () {
            selectedMarker = toPin;
            counter++;
        };

        map.markers.add(toPin);

        // Create instance of new pin
        var originImg = document.createElement('img');
        originImg.src = 'img/ylw-pushpin.png';
        originImg.id = 'origin';        

        originPin = new atlas.HtmlMarker({
            draggable: true,
            htmlContent: originImg,
            position: [0, 0],
            pixelOffset: [0, 0],
            anchor: 'bottom-left'
        });

        originImg.onmousedown = function () {
            selectedMarker = originPin;
            counter++;
        };

        map.markers.add(originPin);

        map.events.add('mouseup', function (e) {
            e.preventDefault();
            if (selectedMarker == originPin)
            {
                routeDataSource.clear();
                routeDataSource2.clear();

                var fromPos = fromPin.getOptions().position;
                var toPos = toPin.getOptions().position;
                var originPos = originPin.getOptions().position;

                var snapped = snapToRouteNetwork(originPos);
                if (snapped)
                {
                    fromPin.setOptions({position: snapped.geometry.coordinates});
                }

                fromPos = fromPin.getOptions().position;

                //Calculate a route.
                calculateRoute(routeLine, routeDataSource, fromPos, toPos, vertices, pathFinder);
                calculateRoute(routeLine2, routeDataSource2, fromPos, originPos, vertices2, pathFinder2);

                selectedMarker = null;
            }
        });
    });

    var html = [];
    Object.keys(geoJsonFiles).forEach(function(val) {
        html.push('<option value="', val, '">', val, '</option>');
    });

    document.getElementById('GeoJsonFiles').innerHTML = html.join('');

    document.getElementById('fileSelector').addEventListener('change', handleFileSelect, false);

    PageLoaded();

    return true;
}

function PageLoaded(){
    // Auto Complete 
    // var subscriptionKey = 'C0gsjhU5t6j0wokXSdyqGz5hVxp2qxOEUoNLFSP-sM4';
    var subscriptionKey = 'tTk1JVEaeNvDkxxnxHm9cYaCvqlOq1u-fXTvyXn2XkA';
    var addresssGeocodeServiceUrlTemplate = 'https://atlas.microsoft.com/search/address/json?typeahead=true&subscription-key={subscription-key}&api-version=1&query={query}&language={language}&countrySet={countrySet}&view=Auto';
    $("#searchBox").autocomplete({
        minLength: 3,   //Don't ask for suggestions until atleast 3 characters have been typed. This will reduce costs by not making requests that will likely not have much relevance.
        source: function (request, response) {
            //Create a URL to the Azure Maps search service to perform the address search.
            var requestUrl = addresssGeocodeServiceUrlTemplate.replace('{query}', encodeURIComponent(request.term))
                .replace('{subscription-key}', subscriptionKey)
                .replace('{language}', 'en-US')
                .replace('{countrySet}', 'US'); //A comma seperated string of country codes to limit the suggestions to.

            $.ajax({
                url: requestUrl,
                success: function (data) {
                    response(data.results);
                }
            });
        },
        select: function (event, ui) {
            //When a suggestion has been selected.
            var selection = ui.item;

            // SET THIS TO ORIGIN PIN
            // console.log(selection.position);
            selectionLat = selection.position.lat;
            selectionLong = selection.position.lon;

            //Populate the address textbox values.
            document.getElementById('addressLineTbx').value = (selection.address.streetNumber ? (selection.address.streetNumber  + ' ') : '') + (selection.address.streetName || '');
            document.getElementById('cityTbx').value = selection.address.municipality || '';
            document.getElementById('countyTbx').value = selection.address.countrySecondarySubdivision || '';
            document.getElementById('stateTbx').value = selection.address.countrySubdivision || '';
            document.getElementById('postalCodeTbx').value = selection.address.postalCode || '';
            document.getElementById('countryTbx').value = selection.address.countryCodeISO3 || '';

            loadGeoJSON();
        }
    }).autocomplete("instance")._renderItem = function (ul, item) {
        //Format the displayed suggestion to show the formatted suggestion string.
        var suggestionLabel = item.address.freeformAddress;

        if (item.poi && item.poi.name) {
            suggestionLabel = item.poi.name + ' (' + suggestionLabel + ')';
        }

        return $("<li id=\"suggestionList\">")
            .append("<a id=\"suggestionLable\">" + suggestionLabel + "</a>")
            .appendTo(ul);
    };
}

//Updates the waypoint information in the from/to textboxes.
function setWaypoint(marker) {
    var opt = marker.getOptions();
    var waypointId = opt.htmlContent.id;
    document.getElementById(waypointId + 'Tbx').value = positionToString(opt.position);
}

function reset() {
    routeDataSource.clear();
    routeDataSource2.clear();
    dataSource.clear();
    dataSource2.clear();
    counter = 0;
    colorcounter = 0;
    pathFinder = null;
    pathFinder2 = null;
    routeLine = null;
    routeLine2 = null;
    selectedMarker = null;
    // document.getElementById('fromTbx').value = '';
    // document.getElementById('toTbx').value = '';
    // document.getElementById('originTbx').value = '';
}

//Loads a GeoJSON file of lines and creates a route network.
function loadGeoJSON() {
    reset();
    // document.getElementById("fileSelector").value = '';
    document.getElementById('loadingIcon').style.display = '';

    // var elm = document.getElementById('GeoJsonFiles');
    // var fileId = elm.options[elm.selectedIndex].value;

    // var url = geoJsonFiles[fileId];
    url = geoJsonFiles['GIS_Conduit'];
    // url = geoJsonFiles['GIS_FiberCable'];
    // url = geoJsonFiles['GIS_Street'];

    if (url && url !== '') {
        //Download the data.
        fetch(url)
            .then(function(response) {
                return response.json();
            }).then(function(data) {
                let data1 = data;

                url = geoJsonFiles['GIS_Street'];
                // url = geoJsonFiles['ssGravity Main'];
                // url = geoJsonFiles['GIS_Fibercable (214KB)'];
                fetch(url)
                    .then(function(response) {
                        return response.json();
                    }).then(function(data) {
                        initNetwork(data1, data);
                    });
            });
    } else {
        document.getElementById('loadingIcon').style.display = 'none';
        return false;
    }

    return true;

}

function handleFileSelect(e) {
    reset();
    document.getElementById('GeoJsonFiles').selectedIndex = 0;

    document.getElementById('loadingIcon').style.display = '';

    var files = e.target.files;
    if (files.length > 0) {
        var reader = new FileReader();

        reader.onload = function (e) {
            var fc = JSON.parse(e.target.result);

            if (fc.type && fc.type === 'FeatureCollection') {
                initNetwork(fc, fc);
            } else {
                alert('Route network must be a GeoJSON file containing a feature collection of linestrings.');
                document.getElementById('loadingIcon').style.display = 'none';
            }
        };

        reader.onerror = function (e) {
            alert(e);
            document.getElementById('loadingIcon').style.display = 'none';
        };

        reader.readAsText(files[0]);
    }
}

function initNetwork(fc, fc2) {
    // console.log(fc, fc2);
    var features = [];
    var features2 = [];
    //Clean data, and flatten MultiLineStrings into LineStrings.
    for (var i = 0, len = fc.features.length; i < len; i++) {
        if (fc.features[i].geometry.type === 'LineString') {
            features.push(fc.features[i]);
        } else if (fc.features[i].geometry.type === 'MultiLineString') {
            for (var j = 0; j < fc.features[i].geometry.coordinates.length; j++) {
                features.push(new atlas.data.Feature(new atlas.data.LineString(fc.features[i].geometry.coordinates[j])));
            }
        }
    }

    // console.log(features);

    //Clean data, and flatten MultiLineStrings into LineStrings.
    for (var i = 0, len = fc2.features.length; i < len; i++) {
        if (fc2.features[i].geometry.type === 'LineString') {
            features2.push(fc2.features[i]);
        } else if (fc2.features[i].geometry.type === 'MultiLineString') {
            for (var j = 0; j < fc2.features[i].geometry.coordinates.length; j++) {
                features2.push(new atlas.data.Feature(new atlas.data.LineString(fc2.features[i].geometry.coordinates[j])));
            }
        }
    }

    // console.log(features2);


    if (features.length === 0) {
        alert('No linestring data found.');
        return false;
    } else {

        geojson = new atlas.data.FeatureCollection(features);
        geojson2 = new atlas.data.FeatureCollection(features2);
        // console.log(geojson, geojson2);

        //Add the geojson data to the data source.
        dataSource.add(geojson);
        dataSource2.add(geojson2);
        // console.log(dataSource, dataSource2);


        map.setCamera({
            bounds: atlas.data.BoundingBox.fromData(geojson2)
        });

        pathFinder = new PathFinder(geojson, {
            precision: 1e-6
        });

        pathFinder2 = new PathFinder(geojson2, {
            precision: 1e-6
        });
        // console.log(pathFinder, pathFinder2);

        //Store the vertices of the path finder graph as a feature colleciton for fast snapping.l
        var v = pathFinder._graph.vertices;
        vertices = new atlas.data.FeatureCollection(Object.keys(v)
            .filter(function (nodeName) {
                return Object.keys(v[nodeName]).length;
            })
            .map(function (nodeName) {
                var vertice = pathFinder._graph.sourceVertices[nodeName];
                return new atlas.data.Feature(new atlas.data.Point(vertice), {
                    nodeName: nodeName
                });
            }.bind(this)));

        var v2 = pathFinder2._graph.vertices;
        vertices2 = new atlas.data.FeatureCollection(Object.keys(v2)
            .filter(function (nodeName) {
                return Object.keys(v2[nodeName]).length;
            })
            .map(function (nodeName) {
                var vertice2 = pathFinder2._graph.sourceVertices[nodeName];
                return new atlas.data.Feature(new atlas.data.Point(vertice2), {
                    nodeName: nodeName
                });
            }.bind(this)));

        //Set the initial position of the start/end points to the first and last vertices in the route network.
        var vKeys = Object.keys(pathFinder._graph.sourceVertices);
        var vKeys2 = Object.keys(pathFinder2._graph.sourceVertices);

        // Set place of new pin
        if (selectionLat != 0)
        {
            var coord = [selectionLong, selectionLat];
            originPin.setOptions({ position: coord });
        }
        else
        {
            originPin.setOptions({ position: pathFinder._graph.sourceVertices[vKeys[0]] }); 
        }
        // setWaypoint(originPin);

        fromPin.setOptions({ position: originPin.getOptions().position});
        var snapped = snapToRouteNetwork(fromPin.getOptions().position);

        if (snapped)
        {
            fromPin.setOptions({position: snapped.geometry.coordinates});
        }
        // setWaypoint(fromPin);

        // Changed the StartPin to be at City Hall in Spokane 
        // var cityHall = [-117.42353973909697, 47.66016450525388] // --> GIS_Street
        var cityHall = [-117.42359063538683, 47.66008904692595]; // --> GIS_Conduit
        // var cityHall = [-117.42359063538683,47.66008904692595]; // --> GIS_FiberCable
        
        toPin.setOptions({ position: cityHall });
        // setWaypoint(toPin);
        selectedMarker = null;

        
        var fromPos = fromPin.getOptions().position;
        var toPos = toPin.getOptions().position;
        var originPos = originPin.getOptions().position;

        calculateRoute(routeLine, routeDataSource, fromPos, toPos, vertices, pathFinder);
        calculateRoute(routeLine2, routeDataSource2, fromPos, originPos, vertices2, pathFinder2);

        /*  */


    }

    document.getElementById('loadingIcon').style.display = 'none';
    return true;
}


//Calculates a route between the from/to positions.
function calculateRoute(rL, dS, pos1, pos2, v, pF) {

    if (rL && dS.getShapeById(rL.getId())) {
        dS.remove(rL);
        rL = null;
    }

    var vertice1 = snapToVertice(pos1, v);
    var vertice2 = snapToVertice(pos2, v);

    var path;
    
    //Check to see if path should cross anti-meridian.
    if (crossAntiMeridian && Math.abs(pos1[0] - pos2[0]) > 180) {
        var l1, l2;

        var rightMostPos = pos1;
        var leftMostPos = pos2;
        var rightVertice = vertice1;
        var leftVertice = vertice2;

        if (pos1[0] > pos2[0]) {
            rightMostPos = pos1;
            leftMostPos = pos2;
            rightVertice = vertice1;
            leftVertice = vertice2;
        }

        //Wrap the left most coordinate to a value between 180 and 540, then split on anti-meridian.
        var fc = turf.lineSplit(
            //Line to split.
            turf.lineString([rightMostPos, [leftMostPos[0] + 360, leftMostPos[1]]]),

            //Line to split with.
            turf.lineString([[180, 90], [180, -90]]));

        //Handle right most part of path.
        var midPos = fc.features[0].geometry.coordinates[1];
        
        var midVertice1 = snapToNearestMeridianVertice(midPos, v);

        midPos[0] = -180;

        var midVertice2 = snapToNearestMeridianVertice(midPos, v);

        if (!midVertice1 && !midVertice2) {
            //Unable to calculate mid point vertice, fallback to standard calculation. 
            calculateSimplePath(vertice1, vertice2, pos1, pos2, dS, rL, pF);
            // calculateSimplePath(fromVertice, toVertice, fromPos, toPos, routeDataSource, routeLine);
        }

        path = pF.findPath(rightVertice, midVertice1);

        if (path) {
            l1 = createRouteLine(path.path, rightMostPos, midPos, false, true, rL);
        }

        path = pF.findPath(midVertice2, leftVertice);

        if (path) {
            l2 = createRouteLine(path.path, midPos, leftMostPos, true, false, rL);
        }

        if (l1 && l2) {
            var path1 = l1.getCoordinates();    //Ends with longitude of 180.
            var path2 = l2.getCoordinates();    //Starts with longitude of -180.

            //Ensure the ends of the lines meet at an average latitude on the anti-meridian.
            var avgLat = (path1[path1.length - 1][1] + path2[0][1]) / 2;
            
            path1.push([180, avgLat]);
            path2.unshift([-180, avgLat]);
            
            //Create a multi-linestring from the two lines.
            rL = new atlas.Shape(new atlas.data.MultiLineString([
                path1, path2
            ]));

            dS.add(rL);
        } else {
            //Unable to calculate path, fallback to standard calculation. 
            calculateSimplePath(vertice1, vertice2, pos1, pos2, dS, rL, pF);
            // calculateSimplePath(fromVertice, toVertice, fromPos, toPos, routeDataSource, routeLine);
        }
    }
    else {
        // console.log(pathFinder.findPath(fromVertice, toVertice));
        calculateSimplePath(vertice1, vertice2, pos1, pos2, dS, rL, pF);
        // calculateSimplePath(fromVertice, toVertice, fromPos, toPos, routeDataSource, routeLine );
    }
    return true;
}


//Calculate a path, ignore anti-meridian.
function calculateSimplePath(v1, v2, pos1, pos2, dS, rL, pF) {
    var p = pF.findPath(v1, v2);
    if (p) 
    {
        dS.add(createRouteLine(p.path, pos1, pos2, rL));
    }
}

//Snaps a position to the route network. 
//Tolerance is a min distance in meters that point needs to be away from a line in order for it to be allowed to snap.
function snapToRouteNetwork(position, tolerance) {
    tolerance = tolerance || snappingTolerance;

    if (geojson) {
        var minDistance = Infinity;
        var nearestLine = null;

        //Create a very simple circle around the position to create a tolerance area. 
        var toleranceArea = turf.circle(position, tolerance, { units: 'meters', steps: 4 });

        //Find the line that is closest to the position.
        for (var i = 0, len = geojson.features.length; i < len; i++) {
            //Filter out lines that don't cross the tolerance area. 
            if (turf.booleanCrosses(toleranceArea, geojson.features[i])) {

                //Calculate the distance from the position to the line to find the closest line.
                var d = turf.pointToLineDistance(position, geojson.features[i], { units: 'meters' });
                if (d < minDistance) {
                    minDistance = d;
                    nearestLine = geojson.features[i];
                }
            }
        }
      
        if (nearestLine) {
            //Calculate the actual point on the nearest line to snap to.
            return turf.nearestPointOnLine(nearestLine, position, { units: 'meters' });
        }
    }

    return null;
}

//Finds the closest vertice in the route network to a position.
function snapToVertice(position, v) {
    if (v) {
        return turf.nearestPoint(new atlas.data.Point(position), v);
    }

    return null;
}

//Finds the closest vertice in the route network to a position, but on the correct side of the anti-meridian.
function snapToNearestMeridianVertice(position, v) {
    if (v) {
        var minDis = Number.MAX_VALUE, d, closestVertice = null, p;

        var isNeg = position[0] < 0;

        for (var i = 0, len = v.features.length; i < len; i++) {
            p = v.features[i].geometry.coordinates;

            //Only look at positions that are on the same longitudinal hemisphere (positive or negative).
            if ((isNeg && p[0] < -179.9) || (!isNeg && p[0] >= 179.9)) {
                d = atlas.math.getDistanceTo(position, p);

                if (d < minDis) {
                    closestVertice = v.features[i];
                    minDis = d;
                }
            }
        }

        if (!closestVertice) {
            return snapToVertice(position, v);
        }
        
        return closestVertice;
    }

    return null;
}

//Creates a route line from the path information. 
//Tries to clip / extend the line such that it aligns with the from / to positions. 
function createRouteLine(path, fromPoint, toPoint, skipFromSnapping, skipToSnapping, rL) {

    if (path.length === 0) {
        return new atlas.data.LineString([fromPoint, toPoint]);
    } else if (path.length === 1) {
        var b1 = turf.bearing(fromPoint, path[0]);
        var b2 = turf.bearing(toPoint, path[0]);

        if (Math.abs(b1 - b2) < 5) {
            path = [fromPoint, toPoint];
        } else {
            path = [fromPoint, path[0], toPoint];
        }
    }

    var line = new atlas.data.LineString(path);
    var buffer = turf.buffer(line, 1, { units: 'meters' });
    var d1, d2;

    if (!skipFromSnapping && turf.pointsWithinPolygon([fromPoint], buffer).features.length === 0) {
        d1 = turf.distance(fromPoint, path[0]);
        d2 = turf.distance(fromPoint, path[path.length - 1]);

        if (d1 !== 0 && d2 !== 0) {
            if (d1 < d2) {
                path.splice(0, 0, fromPoint);
            } else {
                path.push(fromPoint);
            }
        }
    }

    if (!skipToSnapping && turf.pointsWithinPolygon([toPoint], buffer).features.length === 0) {
        d1 = turf.distance(toPoint, path[0]);
        d2 = turf.distance(toPoint, path[path.length - 1]);

        if (d1 !== 0 && d2 !== 0) {
            if (d1 < d2) {
                path.splice(0, 0, toPoints);
            } else {
                path.push(toPoint);
            }
        }
    }

    rL = new atlas.Shape(turf.lineSlice(fromPoint, toPoint, new atlas.data.LineString(path)));
    return rL;

    // if(rL == routeLine){
    //     routeLine = new atlas.Shape(turf.lineSlice(fromPoint, toPoint, new atlas.data.LineString(path)));
    //     return routeLine;
    // }
    // if(rL == routeLine2){
    //     routeLine2 = new atlas.Shape(turf.lineSlice(fromPoint, toPoint, new atlas.data.LineString(path)));
    //     return routeLine2;
    // }
    
}

//Converts a position into a string with 6 decimal places at most.
function positionToString(position) {
    if (position.geometry) {
        position = position.geometry.coordinates;
    }

    return Math.round(position[0] * 100000) / 100000 + ',' + Math.round(position[1] * 100000) / 100000;
}

//Parses a position value from a string.
function parsePosition(posString) {
    var v = posString.split(/\s*,\s*/);

    if (v.length >= 2) {
        return [parseFloat(v[0]), parseFloat(v[1])];
    }

    return null;
}

window.onload = GetMap;

//TODO: 
// - split out route code into seperate class to make more reusable. 
// - Use spatial IO module to support more file formats.
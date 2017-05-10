declare var google: any;

import geoMathUtils = require("geo-math-utils")

var NORMAL_COLOR  = '#00FF00';
var SELECTED_COLOR  = '#0000FF';

export class Polygon {
    vertices: number[];
    
    displayListener: any = null;

    position: {
        x: number,
        y: number
    } = {
        x: 0,
        y: 0
    };

    rotation: number = 0;

    transformate(start: {x: number, y: number}, end: {x: number, y: number}): void {

    }
    
    wheelScrolled(scrollEvent: any): void {
        if(this.displayListener) {
            this.displayListener({wheelEvent: scrollEvent});
        }
    }
    
    onDisplay(): void {
        if(this.displayListener) {
            this.displayListener({});
        }
    }
}

export class Region {
    polys: Polygon[] = [];

    selection: Polygon[] = [];
    
    private controlsState = {
        shiftPressed: false,

        leftMousePressed: false,
        middleMousePressed: false,

        rotationPressed: false,
        transformationPressed: false,

        drag: {
            startAtPosition: {x: 0, y: 0, screenX: 0, screenY: 0},
            lastPosition: {x: 0, y: 0, screenX: 0, screenY: 0}
        },

        mousePosition: {x: 0, y: 0, screenX: 0, screenY: 0}
    }

    constructor(private map, private origin: {lat: number, lon: number}) {
        this.setupRegionListeners();
    }
    
    changeOrigin(newOrigin: {lat: number, lon: number}) {
        var shift = geoMathUtils.toXY(this.origin.lat, this.origin.lon, newOrigin.lat, newOrigin.lon);
        this.origin = newOrigin;
        
        this.movePolygons(this.polys, {x: -shift.x, y: -shift.y});
    }

    getAllPolygons(): Polygon[] {
        return [].concat(this.polys);
    }

    addPolygon(poly: Polygon): void {
        this.polys.push(poly);

        this.displayPoly(poly);
        
        this.setupListeners(poly);
    }

    rotatePolygons(polys: Polygon[], start: {x: number, y: number}, end: {x: number, y: number}): void {
        var x = 0;
        var y = 0;

        polys.forEach(poly => {
            x += poly.position.x;
            y += poly.position.y;
        });

        x = x / polys.length;
        y = y / polys.length;
        
        var selectionCenter = {x, y};

        var rotation = getRotation(selectionCenter, start, end);

        var cos = Math.cos(rotation);
        var sin = Math.sin(rotation);

        polys.forEach(poly => {
            poly.rotation = poly.rotation + rotation;

            poly.position = rotateVectorAround(poly.position, selectionCenter, sin, cos);

            this.displayPoly(poly);
        });
    }
    
    movePolygons(polys: Polygon[], shift: {x: number, y: number}): void {
        polys.forEach(poly => {
            poly.position.x = poly.position.x + shift.x;
            poly.position.y = poly.position.y + shift.y;

            this.displayPoly(poly);
        });
    }
    
    wheelScrolled(polys: Polygon[], event: any): void {
        polys.forEach(poly => {
            poly.wheelScrolled(event);

            this.displayPoly(poly);
        });
    }

    transformPolygons(polys: Polygon[], start: {x: number, y: number}, end: {x: number, y: number}): void {
        polys.forEach(poly => {
            poly.transformate(start, end);

            this.displayPoly(poly);
        });
    }
    
    setPolygonsPosition(polys: Polygon[], position: {x: number, y: number}) {
        var x = 0;
        var y = 0;

        polys.forEach(poly => {
            x += poly.position.x;
            y += poly.position.y;
        });
        
        x = x / polys.length;
        y = y / polys.length;
        
        polys.forEach(poly => {
            this.hidePoly(poly);

            poly.position.x = poly.position.x - x + position.x;
            poly.position.y = poly.position.y - y + position.y;

            this.displayPoly(poly);
        });
    }
    
    private clearSelection(): void {
        this.selection = [];
    };

    private addSelection(selection: Polygon[]): void {
        var newSelection = [];

        this.selection.forEach(poly => {
            for(var i = 0; i < selection.length; i++) {
                if(selection[i] === poly) {
                    return;
                }
            }

            newSelection.push(poly);
        });

        selection.forEach(poly => {
            if(this.isSelected(poly)) {
                return;
            }

            newSelection.push(poly);
        });

        this.selection = newSelection;
    }

    private drawSelectionState() {
        this.polys.forEach(poly => {
            (<any>poly).gPoly.setOptions({
                fillColor: this.isSelected(poly) ? SELECTED_COLOR : NORMAL_COLOR,
                strokeColor: this.isSelected(poly) ? SELECTED_COLOR : NORMAL_COLOR
            });
        });
    }

    private isSelected(poly: Polygon): boolean {
        for(var i = 0; i < this.selection.length; i++) {
            if(this.selection[i] === poly) {
                return true;
            }
        }

        return false;
    }

    private setupListeners(poly: Polygon): void {
        google.maps.event.addListener((<any>poly).gPoly, 'click', (event: any) => {
            if(!this.controlsState.shiftPressed) {
                this.clearSelection();
            }
            
            this.addSelection([poly]);
            
            this.drawSelectionState();
        });
    }
    
    private setupRegionListeners() {
        var div = this.map.getDiv();

        div.tabIndex = 0;

        div.addEventListener("mouseover", (event) => {
            div.focus();

            return preventDefault(event);
        });

        div.addEventListener("mousedown", (event) => {
            if(event.which === 1) {
                this.controlsState.leftMousePressed = true;

                this.setupDragStartPositions(event)
            } else if(event.which === 2) {
                this.controlsState.middleMousePressed = true;

                this.setupDragStartPositions(event);
            }

            return preventDefault(event);
        });

        div.addEventListener("mouseup", (event) => {
            if(event.which === 1) {
                this.controlsState.leftMousePressed = false;
            } else if(event.which === 2) {
                this.controlsState.middleMousePressed = false;
            }

            return preventDefault(event);
        });

        div.addEventListener("mousewheel", (event) => {
            var delta = event.deltaY;

            this.wheelScrolled(this.selection, event);

            return preventDefault(event);
        });
        
        div.addEventListener("mousemove", (event) => {
            if(this.controlsState.leftMousePressed && this.selection.length > 0) {
                this.setupMousePositions(event);

                if(this.controlsState.rotationPressed) {
                    this.rotatePolygons(this.selection, this.controlsState.drag.lastPosition,  this.controlsState.mousePosition);
                } else if(this.controlsState.transformationPressed) {
                    this.transformPolygons(this.selection, this.controlsState.drag.lastPosition,  this.controlsState.mousePosition);
                } else {
                    var positionShift = {
                        x: this.controlsState.mousePosition.x - this.controlsState.drag.lastPosition.x,
                        y: this.controlsState.mousePosition.y - this.controlsState.drag.lastPosition.y
                    };

                    this.movePolygons(this.selection, positionShift);
                }

                this.setupDragLastPositions();
            } else if(this.controlsState.middleMousePressed) {
                this.setupMousePositions(event);
                
                var positionShift = {
                    x: this.controlsState.mousePosition.screenX - this.controlsState.drag.lastPosition.screenX,
                    y: this.controlsState.mousePosition.screenY - this.controlsState.drag.lastPosition.screenY
                };
                
                this.map.panBy(-positionShift.x, -positionShift.y);
                
                this.setupDragLastPositions();
            }

            return preventDefault(event);
        });
        
        this.setupKey('Shift', 'shiftPressed');
        this.setupKey('KeyR', 'rotationPressed');
        this.setupKey('KeyT', 'transformationPressed');
    }

    private setupMousePositions(event: any): void {
        var currentPosition = this.getMousePosition(event);
        var currentScreenPosition = this.getMouseScreenPosition(event);

        this.controlsState.mousePosition.x = currentPosition.x;
        this.controlsState.mousePosition.y = currentPosition.y;
        this.controlsState.mousePosition.screenX = currentScreenPosition.x;
        this.controlsState.mousePosition.screenY = currentScreenPosition.y;
    }

    private setupDragStartPositions(event: any): void {
        var currentPosition = this.getMousePosition(event);
        var currentScreenPosition = this.getMouseScreenPosition(event);

        this.controlsState.drag.startAtPosition = {x: currentPosition.x, y: currentPosition.y, screenX: currentScreenPosition.x, screenY: currentScreenPosition.y};
        this.controlsState.drag.lastPosition = {x: currentPosition.x, y: currentPosition.y, screenX: currentScreenPosition.x, screenY: currentScreenPosition.y};
    }

    private setupDragLastPositions(): void {
        this.controlsState.drag.lastPosition.x = this.controlsState.mousePosition.x;
        this.controlsState.drag.lastPosition.y = this.controlsState.mousePosition.y;
        this.controlsState.drag.lastPosition.screenX = this.controlsState.mousePosition.screenX;
        this.controlsState.drag.lastPosition.screenY = this.controlsState.mousePosition.screenY;
    }

    private setupKey(code: string, inputFlagName: string, toggle?: boolean): void {
        var div = this.map.getDiv();

        div.addEventListener("keydown", (event) => {
            if(event.key === code || event.code === code) {
                this.controlsState[inputFlagName] = true;
            }

            return preventDefault(event);
        });

        div.addEventListener("keyup", (event) => {
            if(event.key === code || event.code === code) {
                this.controlsState[inputFlagName] = false;
            }

            return preventDefault(event);
        });
    }
    
    private displayPoly(poly: Polygon): void {
        var paths = [];
        
        var sin = Math.sin(poly.rotation);
        var cos = Math.cos(poly.rotation);

        for(var i = 0; i < poly.vertices.length / 2; i++) {
            var vertex = {
                x: poly.vertices[i * 2],
                y: poly.vertices[i * 2 + 1]
            }
            
            var rotated = rotateVector(vertex, sin, cos);

            var latlon = geoMathUtils.toLatLon(this.origin.lat, this.origin.lon, poly.position.x + rotated.x, poly.position.y + rotated.y);

            var result = {
                lat: latlon.lat,
                lng: latlon.lon
            }
            
            paths.push(result);
        }

        var gPoly = (<any>poly).gPoly || new google.maps.Polygon({});

        gPoly.setOptions({
            map: this.map,
            paths: paths,
            strokeColor: this.isSelected(poly) ? SELECTED_COLOR : NORMAL_COLOR,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: this.isSelected(poly) ? SELECTED_COLOR : NORMAL_COLOR,
            fillOpacity: 0.35,
            draggable: false,
            geodesic: true
        });

        (<any>poly).gPoly = gPoly;

        poly.onDisplay();
    }

    private hidePoly(poly: Polygon): void {
        var gPoly = (<any>poly).gPoly;

        if(gPoly) {
            gPoly.setMap(null);
        }
    }

    private getMousePosition(event: any): {x: number, y: number} {
        var point = {
            x: event.offsetX,
            y: event.offsetY
        }

        var mapPosition = fromPixelToLatLng(this.map, point);

        return geoMathUtils.toXY(this.origin.lat, this.origin.lon, mapPosition.lat(), mapPosition.lng());
    }

    private getMouseScreenPosition(event: any): {x: number, y: number} {
        var point = {
            x: event.offsetX,
            y: event.offsetY
        }

        return point;
    }
}

export class Rectangle extends Polygon {
    private indeces: any = {
        'left-bottom': {x: 0, y: 1},
        'left-top': {x: 2, y: 3},
        'right-top': {x: 4, y: 5},
        'right-bottom': {x: 6, y: 7}
    }
    
    private sides: any = {
        left: ['left-bottom', 'left-top', 'width', -1],
        right: ['right-bottom', 'right-top', 'width', 1],
        top: ['left-top', 'right-top', 'height', 1],
        bottom: ['left-bottom', 'right-bottom', 'height', -1]
    }

    constructor(public bounds: {width: number, height: number}, position: {x: number, y: number}) {
        super();
        
        this.position = position;
        
        this.setupVertices();
    }

    private setupVertices() {
        var x = this.bounds.width/2;
        var y = this.bounds.height/2;
        
        if(!this.vertices) {
            this.vertices = [];
        }

        this.vertices[0] = -x;
        this.vertices[1] = -y;

        this.vertices[2] = -x;
        this.vertices[3] = y;

        this.vertices[4] = x;
        this.vertices[5] = y;

        this.vertices[6] = x;
        this.vertices[7] = -y;
    }

    transformate(start: {x: number, y: number}, end: {x: number, y: number}): void {
        var relativeStart = {x: start.x - this.position.x, y: start.y - this.position.y};
        var relativeEnd = {x: end.x - this.position.x, y: end.y - this.position.y};

        var sin = Math.sin(-this.rotation);
        var cos = Math.cos(-this.rotation);

        relativeStart = rotateVector(relativeStart, sin, cos);
        relativeEnd = rotateVector(relativeEnd, sin, cos);

        var deltas = this.getDeltas(relativeStart, relativeEnd);
        
        if(!deltas) {
            return;
        }

        this.bounds.width += deltas.width;
        this.bounds.height += deltas.height;
        
        deltas = rotateVector(deltas, -sin, cos);

        this.position.x += deltas.x;
        this.position.y += deltas.y;

        this.setupVertices();
    }

    private getDeltas(start: {x: number, y: number}, end: {x: number, y: number}): any {
        var sideNames = Object.keys(this.sides);
        
        for(var i = 0; i < 4; i++) {
            var side = this.sides[sideNames[i]];
            
            var index1 =  this.indeces[side[0]];
            var index2 =  this.indeces[side[1]];
            
            var v1 = {x: this.vertices[index1.x], y: this.vertices[index1.y]};
            var v2 = {x: this.vertices[index2.x], y: this.vertices[index2.y]};
            
            if(isPointBetween(v1, v2, start)) {
                var direction = side[2] === "width" ? {x: 1, y: 0} : {x: 0, y: 1};

                var shift = {x: end.x - start.x, y: end.y - start.y}

                var delta = projection(shift, direction);

                return {
                    width: direction.x * delta * side[3],
                    height: direction.y * delta * side[3],
                    x: direction.x * delta/2,
                    y: direction.y * delta/2
                }
            }
        }
        
        return null;
    }
}

function fromLatLngToPixel(map, position) {
    var scale = Math.pow(2, map.getZoom());

    var proj = map.getProjection();

    var bounds = map.getBounds();

    var nw = proj.fromLatLngToPoint(new google.maps.LatLng(bounds.getNorthEast().lat(), bounds.getSouthWest().lng()));

    var point = proj.fromLatLngToPoint(position);

    return new google.maps.Point(Math.floor((point.x - nw.x) * scale), Math.floor((point.y - nw.y) * scale));
}

function fromPixelToLatLng(map, pixel) {
    var scale = Math.pow(2, map.getZoom());

    var proj = map.getProjection();

    var bounds = map.getBounds();

    var nw = proj.fromLatLngToPoint(new google.maps.LatLng(bounds.getNorthEast().lat(), bounds.getSouthWest().lng()));

    var point = new google.maps.Point();

    point.x = pixel.x / scale + nw.x;
    point.y = pixel.y / scale + nw.y;

    return proj.fromPointToLatLng(point);
}

function getRotation(position, dragStart, dragEnd) {
    var v1 = {x: dragStart.x - position.x, y: dragStart.y - position.y};
    var v2 = {x: dragEnd.x - position.x, y: dragEnd.y - position.y};

    var l1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    var l2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    var result = (<any>Math).sign(v1.x * v2.y - v1.y * v2.x) * Math.acos(dot(v1, v2) / (l1 * l2));

    return result || 0;
}

function rotateVectorAround(vector, around, sin, cos) {
    var oldVector = {
        x: vector.x - around.x,
        y: vector.y - around.y
    }

    var newVector = rotateVector(oldVector, sin, cos);

    return {
        x: around.x + newVector.x,
        y: around.y + newVector.y
    };
}

function length(v) {
    return Math.sqrt(v.x*v.x + v.y * v.y);
}

function distance(v1, v2) {
    var diff = {x: v1.x - v2.x, y: v1.y - v2.y};

    return length(diff);
}

function rotateVector(vector, sin, cos) {
    return {
        x: vector.x * cos - vector.y * sin,
        y: vector.y * cos + vector.x * sin
    };
}

function dot(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
}

function cross(v1, v2) {
    return v1.x * v2.y - v1.y * v2.x;
}

function projection(v1, v2) {
    return dot(v1, v2) / length(v2);
}

function isPointBetween(v1, v2, point) {
    var proj1 = projection(v1, point);
    var proj2 = projection(v2, point);
    
    if(proj1 <= 0 || proj2 <= 0) {
        return false;
    }
    
    var cross1 = cross(v1, point);
    var cross2 = cross(v2, point);
    
    if((<any>Math).sign(cross1) + (<any>Math).sign(cross2) === 0) {
        return true;
    }
    
    return false;
}

function preventDefault(event): boolean {
    event.stopPropagation();
    event.preventDefault();
    
    return false;
};
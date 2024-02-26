// License: CC0 public domain: https://creativecommons.org/publicdomain/zero/1.0/deed.en

if(!window.$) window.$ = (...args) => document.querySelector(...args)

const ez = {
    canvas: null,
    ctx: null,
    camera: null,
    useProjectionMatrix: 0,
    projectionMatrixOverride: null,
    centerOrigin: false
}

///////////////////////
// SETUP BOILERPLATE //
///////////////////////

ez.setCanvas = function(canvas) {
    ez.canvas = canvas
    ez.ctx = canvas.getContext("2d")
}

ez.clear = function(color) {
    ez.ctx.clearRect(0, 0, ez.canvas.width, ez.canvas.height);
    if(color !== undefined) {
        this.ctx.save();
        this.ctx.fillStyle = ez.parseColor(color);
        ez.ctx.fillRect(0, 0, ez.canvas.width, ez.canvas.height);
        this.ctx.restore();
    }
}

ez.blitCanvas = function(otherCanvas) {
    ez.ctx.drawImage(otherCanvas, 0, 0);
}

let savedEzs = [];
ez.save = function() {
    savedEzs.push({...ez});
    ez.ctx.save();
}

ez.restore = function() {
    Object.assign(ez, savedEzs.pop());
    ez.ctx.restore();
}

ez.createCanvasAndAddToPage = function(width, height) {
    ez.canvas = document.createElement("canvas");
    document.body.appendChild(ez.canvas);

    if (width && height) {
        ez.canvas.width = width;
        ez.canvas.height = height;
    } else {
        const canvas = ez.canvas;

        // Style the canvas
        canvas.style.display = 'block'; // Remove extra space below canvas

        // Style the body to remove margins and overflow
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden'; // Hide scrollbars

        // Ensure canvas is always in the top-left corner
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.outline = 'none'; // Kept getting focus outline, so making this the default.

        // Set full-screen styles
        const resizeCanvas = () => {
            // Adjust canvas size
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        // Apply styles initially and on resize
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Set the canvas to be focusable
        canvas.setAttribute('tabindex', '0');
        // Allow using same mouseDrag etc on mobile.
        canvas.style.touchAction = "none";
    }
    ez.addInputEventListeners(ez.canvas);
    ez.ctx = ez.canvas.getContext("2d");

    ez._update();
    return ez.canvas;
};

// Called before every single function via hack at the bottom of this file.
ez._update = function() {
    if(!ez.canvas) {
        ez.canvas = document.querySelector("canvas");
        if(!ez.canvas) {
            ez.createCanvasAndAddToPage();
        }
    }
    ez.addInputEventListeners(ez.canvas);
    ez.ctx = ez.canvas.getContext("2d");
    ez.camera = ez.camera || mat3x4();
}

/////////////////
// INPUT STUFF //
/////////////////

ez.keys = {};
ez.mousePos = new vec2(0, 0);

ez.keyPressCallbacks = {};
ez.keyDownCallbacks = {};
ez.keyUpCallbacks = {};
ez.mouseMoveCallbacks = [];
ez.mouseDownCallbacks = [];
ez.mouseDragCallbacks = [];
ez.mouseDragEndCallbacks = [];
ez.mouseLeaveCallbacks = [];
ez.mouseDown = { left: false, middle: false, right: false };
ez.isDragging = false;
ez.lastMousePos = new vec2(0, 0);
ez.curCanvasMouseOver = null;

ez.onKeyPress = function(key, callback) {
    if (!ez.keyPressCallbacks[key]) {
        ez.keyPressCallbacks[key] = [];
    }
    ez.keyPressCallbacks[key].push(callback);
};

ez.onKeyDown = function(key, callback) {
    if (!ez.keyDownCallbacks[key]) {
        ez.keyDownCallbacks[key] = [];
    }
    ez.keyDownCallbacks[key].push(callback);
};

ez.onKeyUp = function(key, callback) {
    if (!ez.keyUpCallbacks[key]) {
        ez.keyUpCallbacks[key] = [];
    }
    ez.keyUpCallbacks[key].push(callback);
};

ez.isMouseInCanvas = function(canvas) {
    if(!canvas) canvas = ez.canvas;
    return canvas = ez.curCanvasMouseOver;
};

ez.isMouseDown = function(button="left") {
    return ez.mouseDown[button];
};

ez.onMouseMove = function(callback) {
    ez.mouseMoveCallbacks.push(callback);
};

ez.onMouseDown = function(callback) {
    ez.mouseDownCallbacks.push(callback);
};

ez.onMouseDrag = function(callback) {
    ez.mouseDragCallbacks.push(callback);
};

ez.onMouseDragEnd = function(callback) {
    ez.mouseDragEndCallbacks.push(callback);
};

ez.onMouseLeave = function(callback) {
    ez.mouseLeaveCallbacks.push(callback);
};

ez.isKeyDown = function(key) {
    return ez.keys[key] || false;
};

ez.getMousePos = function() {
    return ez.mousePos;
};

ez.addInputEventListeners = function(canvas) {
    if (canvas.ezEventListenersAdded) return; // Prevent multiple bindings
    canvas.ezEventListenersAdded = true;

    canvas.addEventListener('keydown', function(event) {
        ez.keys[event.key] = true;
    });

    canvas.addEventListener('keyup', function(event) {
        ez.keys[event.key] = false;
    });
    canvas.addEventListener('keypress', function(event) {
        if (ez.keyPressCallbacks[event.key]) {
            ez.keyPressCallbacks[event.key].forEach(cb => cb());
        }
    });

    canvas.addEventListener('keydown', function(event) {
        ez.keys[event.key] = true;
        if (ez.keyDownCallbacks[event.key]) {
            ez.keyDownCallbacks[event.key].forEach(cb => cb());
        }
    });

    canvas.addEventListener('keyup', function(event) {
        ez.keys[event.key] = false;
        if (ez.keyUpCallbacks[event.key]) {
            ez.keyUpCallbacks[event.key].forEach(cb => cb());
        }
    });

    canvas.addEventListener('pointerdown', function(event) {
        ez.curCanvasMouseOver = canvas;
        let rect = canvas.getBoundingClientRect();
        ez.mousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
        ez.mouseDown.left = event.button === 0;
        ez.mouseDown.middle = event.button === 1;
        ez.mouseDown.right = event.button === 2;
        ez.mouseDownCallbacks.forEach(cb => cb());
        ez.lastMousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
    });

    canvas.addEventListener('pointermove', function(event) {
        ez.curCanvasMouseOver = canvas;
        let rect = canvas.getBoundingClientRect();
        ez.mousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
        ez.mouseMoveCallbacks.forEach(cb => cb(ez.mousePos));
        if(ez.isMouseDown("left")) {
            ez.isDragging = true;
        }
        if (ez.isDragging) {
            let delta = ez.mousePos.sub(ez.lastMousePos);
            ez.mouseDragCallbacks.forEach(cb => cb(delta));
        }
        ez.lastMousePos = ez.mousePos;
    });

    canvas.addEventListener('pointerup', function(event) {
        ez.curCanvasMouseOver = canvas;
        let rect = canvas.getBoundingClientRect();
        ez.mousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
        ez.mouseDown.left = !(event.button === 0);
        ez.mouseDown.middle = !(event.button === 1);
        ez.mouseDown.right = !(event.button === 2);
        if (ez.isDragging) {
            ez.isDragging = false;
            ez.mouseDragEndCallbacks.forEach(cb => cb());
        }
        ez.lastMousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
    });

    canvas.addEventListener('pointerleave', function(event) {
        ez.isDragging = false;
        ez.mouseDown.left = ez.mouseDown.middle = ez.mouseDown.right = false;
        ez.curCanvasMouseOver = null;
        ez.mouseDragEndCallbacks.forEach(cb => cb());
        ez.mouseLeaveCallbacks.forEach(cb => cb());
    });
};

///////////////////
// SHAPE DRAWING //
///////////////////

// rect

ez.rect = function ezRect(pos, size, rot, scale) {
    if (!(this instanceof ezRect)) return new ezRect(pos, size, rot, scale);
    this.pos = vec2(pos);
    this.size = vec2(size);
    this.rot = rot || 0; // Rotation in radians
    this.scale = scale || 1;
    this.transform = mat3x4().rotated(vec3(0,0,1), rot || 0);
    this.transform.setOrigin(pos);
};

ez.rect.prototype.drawPath = function() {
    let halfWidth = this.size.x / 2 * this.scale;
    let halfHeight = this.size.y / 2 * this.scale;
    let corners = [
        new vec3(-halfWidth, -halfHeight, 0),
        new vec3(halfWidth, -halfHeight, 0),
        new vec3(halfWidth, halfHeight, 0),
        new vec3(-halfWidth, halfHeight, 0)
    ];

    // Rotate, translate, then apply camera matrix to each corner
    corners = corners.map(corner => {
        let cornerPt = new vec3(
            corner.x,
            corner.y,
            corner.z
        );//.add(this.pos);
        return ez.worldToScreen(cornerPt, this.transform);
        //return ez.camera.multiplyVec3(cornerPt);
    });

    ez.ctx.beginPath();
    ez.ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
        ez.ctx.lineTo(corners[i].x, corners[i].y);
    }
    ez.ctx.closePath();
};

// circle

ez.circle = function ezCircle(pos, radius) {
    if (!(this instanceof ezCircle)) return new ezCircle(pos, radius);
    this.pos = vec2(pos); // Circle's center position
    this.radius = radius; // Circle's radius

    // Prepare the transform for the circle, including scale and position
    this.transform = mat3x4();
    this.transform.setOrigin(this.pos);
};

ez.circle.prototype.drawPath = function() {
    // Apply the transformation to the circle's position
    const transformedCenter = ez.worldToScreen(new vec3(0,0,0), this.transform);

    // Start drawing the circle path
    ez.ctx.beginPath();
    ez.ctx.arc(transformedCenter.x, transformedCenter.y, this.radius, 0, 2 * Math.PI);
    ez.ctx.closePath();
};

// grid

ez.grid = function ezGrid(cellSize, numCells) {
    if (!(this instanceof ezGrid)) return new ezGrid(cellSize, numCells);
    this.cellSize = cellSize || 10;
    this.numCells = numCells || 10;
};

ez.grid.prototype.stroke = function() {
    ez.ctx.beginPath();
    
    const halfNumCells = Math.floor(this.numCells / 2);
    const gridSize = this.cellSize * this.numCells;

    for (let i = -halfNumCells; i <= halfNumCells; i++) {
        const pos = i * this.cellSize;
        const startPoint = new vec3(pos, -gridSize / 2, 0);
        const endPoint = new vec3(pos, gridSize / 2, 0);

        const transformedStartPoint = ez.worldToScreen(startPoint);
        const transformedEndPoint = ez.worldToScreen(endPoint);

        ez.ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
        ez.ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
    }

    for (let i = -halfNumCells; i <= halfNumCells; i++) {
        const pos = i * this.cellSize;
        const startPoint = new vec3(-gridSize / 2, pos, 0);
        const endPoint = new vec3(gridSize / 2, pos, 0);

        const transformedStartPoint = ez.worldToScreen(startPoint);
        const transformedEndPoint = ez.worldToScreen(endPoint);

        ez.ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
        ez.ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
    }

    ez.ctx.stroke();
};

// line

ez.line = function ezLine(startPos, endPos) {
    if (!(this instanceof ezLine)) return new ezLine(startPos, endPos);
    this.startPos = vec2(startPos);
    this.endPos = vec2(endPos);
};

ez.line.prototype.stroke = function() {
    // Transform start and end points using the camera matrix
    const transformedStart = ez.worldToScreen(vec3(this.startPos));
    const transformedEnd = ez.worldToScreen(vec3(this.endPos));

    ez.ctx.beginPath();
    ez.ctx.moveTo(transformedStart.x, transformedStart.y);
    ez.ctx.lineTo(transformedEnd.x, transformedEnd.y);
    ez.ctx.stroke();
};

// arrow

ez.arrow = function ezArrow(startPos, endPos, arrowSize) { 
    if (!(this instanceof ezArrow)) return new ezArrow(startPos, endPos, arrowSize);
    this.startPos = vec2(startPos);
    this.endPos = vec2(endPos);
    this.arrowSize = arrowSize || 10; // Size of the arrowhead
};

ez.arrow.prototype.drawPath = function() {
    // Transform start and end points using the camera matrix
    const transformedStart = ez.worldToScreen(vec3(this.startPos));
    const transformedEnd = ez.worldToScreen(vec3(this.endPos));
    
    // Calculate the direction vector of the arrow
    const direction = transformedEnd.sub(transformedStart).normalized();
    const perpendicular = new vec3(-direction.y, direction.x, 0); // Perpendicular vector for the width of the arrow shaft

    // Define the width of the arrow shaft and the arrowhead base
    const shaftWidth = this.arrowSize / 4; // Adjust the width as needed
    const arrowheadWidth = this.arrowSize; // Width of the base of the arrowhead

    // Calculate points for the shaft of the arrow
    const shaftStartLeft = transformedStart.add(perpendicular.scale(shaftWidth / 2));
    const shaftStartRight = transformedStart.sub(perpendicular.scale(shaftWidth / 2));
    const shaftEndLeft = transformedEnd.sub(direction.scale(this.arrowSize)).add(perpendicular.scale(shaftWidth / 2));
    const shaftEndRight = transformedEnd.sub(direction.scale(this.arrowSize)).sub(perpendicular.scale(shaftWidth / 2));

    // Points for the base of the arrowhead
    const arrowheadBaseCenter = transformedEnd.sub(direction.scale(this.arrowSize));
    const arrowheadLeft = arrowheadBaseCenter.add(perpendicular.scale(arrowheadWidth / 2));
    const arrowheadRight = arrowheadBaseCenter.sub(perpendicular.scale(arrowheadWidth / 2));

    ez.ctx.beginPath();
    // Draw the shaft from one side to the other
    ez.ctx.moveTo(shaftStartLeft.x, shaftStartLeft.y);
    ez.ctx.lineTo(shaftEndLeft.x, shaftEndLeft.y);
    // Draw the left side of the arrowhead
    ez.ctx.lineTo(arrowheadLeft.x, arrowheadLeft.y);
    // Draw to the tip of the arrowhead
    ez.ctx.lineTo(transformedEnd.x, transformedEnd.y);
    // Draw the right side of the arrowhead
    ez.ctx.lineTo(arrowheadRight.x, arrowheadRight.y);
    // Complete the path by drawing the right side of the shaft
    ez.ctx.lineTo(shaftEndRight.x, shaftEndRight.y);
    ez.ctx.lineTo(shaftStartRight.x, shaftStartRight.y);
    // Close the path to connect back to the start
    ez.ctx.closePath();
};

// path

ez.path = function ezPath(points) {
    if (!(this instanceof ezPath)) return new ezPath(points);
    this.points = points.map(point => vec2(point)); // Ensure all points are vec2
};

ez.path.prototype.stroke = function() {
    if (this.points.length < 2) return; // Need at least two points to draw a path

    ez.ctx.beginPath();
    // Move to the first point
    let start = ez.worldToScreen(vec3(this.points[0].x, this.points[0].y, 0));
    ez.ctx.moveTo(start.x, start.y);

    for (let i = 1; i < this.points.length - 2; i++) {
        let cp1 = this.points[i];
        let cp2 = this.points[i + 1];
        
        // Average the current point and the next to find the middle for a smoother transition
        let midPoint = cp1.add(cp2).scale(0.5);
        let transformedMidPoint = ez.worldToScreen(vec3(midPoint.x, midPoint.y, 0));
        let transformedCP1 = ez.worldToScreen(vec3(cp1.x, cp1.y, 0));

        // Quadratic bezier curve to the midpoint, then to the next point
        ez.ctx.quadraticCurveTo(transformedCP1.x, transformedCP1.y, transformedMidPoint.x, transformedMidPoint.y);
    }

    // Draw the last two points
    let cpLast = this.points[this.points.length - 2];
    let end = this.points[this.points.length - 1];
    let transformedCPLast = ez.worldToScreen(vec3(cpLast.x, cpLast.y, 0));
    let transformedEnd = ez.worldToScreen(vec3(end.x, end.y, 0));
    ez.ctx.quadraticCurveTo(transformedCPLast.x, transformedCPLast.y, transformedEnd.x, transformedEnd.y);

    ez.ctx.stroke(); // Apply the stroke to the path
};

// text

ez.text = function ezText(text, pos, options) {
    if (!(this instanceof ezText)) return new ezText(text, pos, options);
    this.text = text;
    this.pos = vec2(pos); // Text position
    this.options = options || {};

    // Default options
    this.fontSize = this.options.fontSize || 16; // Default font size
    this.fontFamily = this.options.fontFamily || 'Arial'; // Default font family
    this.fontStyle = this.options.fontStyle || 'normal'; // Default font style
    this.textAlign = this.options.textAlign || 'center'; // Default text align
    this.textBaseline = this.options.textBaseline || 'alphabetic'; // Default text baseline
};

ez.text.prototype.fill = function() {
    // Apply the text styles
    ez.ctx.font = `${this.fontStyle} ${this.fontSize}px ${this.fontFamily}`;
    ez.ctx.textAlign = this.textAlign;
    ez.ctx.textBaseline = this.textBaseline;

    // Transform the position to screen coordinates
    const transformedPos = ez.worldToScreen(vec3(this.pos.x, this.pos.y, 0));

    // Fill the text
    ez.ctx.fillText(this.text, transformedPos.x, transformedPos.y);
};

ez.text.prototype.stroke = function() {
    // Apply the text styles
    ez.ctx.font = `${this.fontStyle} ${this.fontSize}px ${this.fontFamily}`;
    ez.ctx.textAlign = this.textAlign;
    ez.ctx.textBaseline = this.textBaseline;

    // Transform the position to screen coordinates
    const transformedPos = ez.worldToScreen(vec3(this.pos.x, this.pos.y, 0));

    // Stroke the text
    ez.ctx.strokeText(this.text, transformedPos.x, transformedPos.y);
};

// triangle

ez.triangle = function ezTriangle(pos, points, colors) {
    if (!(this instanceof ezTriangle)) return new ezTriangle(pos, points, colors);
    this.pos = vec3(pos); // Triangle's center position
    if(Array.isArray(points) && points.length === 6) points = [points.slice(0,2),points.slice(2,4),points.slice(4,6)]
    else if(Array.isArray(points) && points.length === 9) points = [points.slice(0,3),points.slice(3,6),points.slice(6,9)]
    this.points = points.map(p => vec3(p)); // Array of points (vec3) relative to center
    this.colors = colors; // Array of colors corresponding to each vertex
    this.isSubdiv = false;

    // Prepare the transform for the triangle, including scale and position
    this.transform = mat3x4();
    this.transform.setOrigin(this.pos);
};

ez.triangle.prototype.stroke = function(color) {
    ez.save();
    
    // Transform each point to screen space
    let transformedPoints = this.points.map(point => ez.worldToScreen(point, this.transform));
    const [p0, p1, p2] = transformedPoints.map(p => vec2(p));

    const drawLineAndInterpolateColors = function(startPoint, endPoint, startColor, endColor) {
        // Calculate the gradient between startColor and endColor
        var gradient = ez.ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);
        
        // Set the stroke style to the gradient and draw the line
        ez.ctx.strokeStyle = gradient;
        ez.ctx.beginPath();
        ez.ctx.moveTo(startPoint.x, startPoint.y);
        ez.ctx.lineTo(endPoint.x, endPoint.y);
        ez.ctx.stroke();
    };
    
    // Draw lines between the points and interpolate colors
    drawLineAndInterpolateColors(p0, p1, color !== undefined ? color : this.colors[0], color !== undefined ? color : this.colors[1]);
    drawLineAndInterpolateColors(p1, p2, color !== undefined ? color : this.colors[1], color !== undefined ? color : this.colors[2]);
    drawLineAndInterpolateColors(p2, p0, color !== undefined ? color : this.colors[2], color !== undefined ? color : this.colors[0]);

    ez.restore();
};

ez.triangle.prototype.fill = function(color) {
    ez.save();
    
    // Transform and project each point to screen space
    let transformedPoints = this.points.map(point => {
        return ez.worldToScreen(point, this.transform);
    });

    // Loop through a bounding box around the triangle and fill in pixels
    const [p0, p1, p2] = transformedPoints.map(p => vec2(p));
    ez.drawTriangle(ez.canvas, ez.ctx, p0, p1, p2, color !== undefined ? color : this.colors[0], color !== undefined ? color : this.colors[1], color !== undefined ? color : this.colors[2]);

    ez.restore();
};

// quad

ez.quad = function ezQuad(pos, points, colors) {
    if (!(this instanceof ezQuad)) return new ezQuad(pos, points, colors);
    this.pos = vec3(pos); // Quad's center position
    if (Array.isArray(points) && points.length === 8) points = [points.slice(0, 2), points.slice(2, 4), points.slice(4, 6), points.slice(6, 8)];
    else if (Array.isArray(points) && points.length === 12) points = [points.slice(0, 3), points.slice(3, 6), points.slice(6, 9), points.slice(9, 12)];
    this.points = points.map(p => vec3(p)); // Array of points (vec3) relative to center
    this.colors = colors; // Array of colors corresponding to each vertex

    // Prepare the transform for the quad, including scale and position
    this.transform = mat3x4();
    this.transform.setOrigin(this.pos);
};

ez.quad.prototype.getTriangles = function(color) {
    // Colors for the triangles (assuming colors are ordered in the same way as points)
    const colorsTriangle1 = [color !== undefined ? color : this.colors[0], color !== undefined ? color : this.colors[1], color !== undefined ? color : this.colors[2]];
    const colorsTriangle2 = [color !== undefined ? color : this.colors[2], color !== undefined ? color : this.colors[3], color !== undefined ? color : this.colors[0]];

    // Create and render the first triangle
    let triangle1 = ez.triangle(this.pos, [this.points[0], this.points[1], this.points[2]], colorsTriangle1);
    triangle1.transform = this.transform;

    // Create and render the second triangle
    let triangle2 = ez.triangle(this.pos, [this.points[2], this.points[3], this.points[0]], colorsTriangle2);
    triangle2.transform = this.transform;

    return [triangle1, triangle2];
}

ez.quad.prototype.fill = function(color) {
    const tris = this.getTriangles(color);
    tris[0].fill();
    tris[1].fill();
};

ez.quad.prototype.stroke = function(color) {
    const tris = this.getTriangles(color);
    tris[0].stroke();
    tris[1].stroke();
};


////////////////
// MATH STUFF //
////////////////

function vec2(...args) {
    let [x, y] = args.map(tryVecToArray).flat(Infinity)
    if ( !(this instanceof vec2) ) return new vec2(x, y);
    this.x = x || 0;
    this.y = y || 0;
}
vec2.prototype.add = function(other) { other = vec2(other); return vec2(this.x + other.x, this.y + other.y); }
vec2.prototype.sub = function(other) { other = vec2(other); return vec2(this.x - other.x, this.y - other.y); }
vec2.prototype.dot = function(other) { other = vec2(other); return this.x * other.x + this.y * other.y; }
vec2.prototype.divide = vec2.prototype.divided = vec2.prototype.div = function(n) {
    if(typeof n === "number") { return vec2(this.x / n, this.y / n); }
    else {
        n = vec2(n);
        return vec2(this.x / n.x, this.y / n.y);
    }
}
vec2.prototype.scale = vec2.prototype.scaled = vec2.prototype.multiply = function(n) {
    if(typeof n === "number") { return vec2(this.x * n, this.y * n); }
    else {
        n = vec2(n);
        return vec2(this.x * n.x, this.y * n.y);
    }
}
vec2.prototype.magnitude = vec2.prototype.mag = vec2.prototype.length = function() { return Math.sqrt(this.x * this.x + this.y * this.y); }
vec2.prototype.duplicate = function() { return vec2(this.x, this.y); }
vec2.prototype.normalized = function() { return vec2(this.x / this.magnitude(), this.y / this.magnitude()); };
vec2.prototype.rounded = vec2.prototype.round = function() { return vec2(Math.round(this.x), Math.round(this.y)); };
vec2.prototype.floor = vec2.prototype.floored = function() { return vec2(Math.floor(this.x), Math.floor(this.y)); };
vec2.prototype.ceil = vec2.prototype.ceiled = function() { return vec2(Math.ceil(this.x), Math.ceil(this.y)); };
vec2.prototype.abs = function() { return vec2(Math.abs(this.x), Math.abs(this.y)); };
vec2.prototype.rotated = function(angle) {
    // get rotated x and y basis vectors and multiply this.x and this.y by them
    let xb = vec2(Math.cos(angle), Math.sin(angle));
    let yb = vec2(Math.sin(angle), Math.cos(angle));
    return xb.scale(this.x).add(yb.scale(this.y));
    // Equivalent to the typical formula:
    //return vec2(Math.cos(angle) * this.x + Math.sin(angle) * this.y, Math.sin(angle) * this.x + Math.cos(angle) * this.y);
}
vec2.prototype.perpendicular_dot = function(other) {
    other = vec2(other);
    return this.x * other.y + this.y * -other.x;
    return this.x * other.y - this.y * other.x; // Same as above. Also same as the z component of vec3 cross
}
vec2.prototype.perpendicular = function() {
    return vec2(this.y, -this.x);
}

function vec3(...args) {
    let [x, y, z] = args.map(tryVecToArray).flat(Infinity)
    if (!(this instanceof vec3)) return new vec3(x, y, z);
    this.x = x || 0; this.y = y || 0; this.z = z || 0;
}

vec3.prototype.add = function(other) { other = vec3(other); return vec3(this.x + other.x, this.y + other.y, this.z + other.z); }
vec3.prototype.sub = function(other) { other = vec3(other); return vec3(this.x - other.x, this.y - other.y, this.z - other.z); }
vec3.prototype.dot = function(other) { other = vec3(other); return this.x * other.x + this.y * other.y + this.z * other.z; }
vec3.prototype.divide = vec3.prototype.divided = vec3.prototype.div = function(n) {
    if(typeof n === "number") { return vec3(this.x / n, this.y / n, this.z / n); }
    else {
        n = vec3(n);
        return vec3(this.x / n.x, this.y / n.y, this.z / n.z);
    }
}
vec3.prototype.scale = vec3.prototype.scaled = vec3.prototype.multiply = function(n) {
    if(typeof n === "number") { return vec3(this.x * n, this.y * n, this.z * n); }
    else {
        n = vec3(n);
        return vec3(this.x * n.x, this.y * n.y, this.z * n.z);
    }
}
vec3.prototype.magnitude = vec3.prototype.mag = vec3.prototype.length = function() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
vec3.prototype.duplicate = function() { return vec3(this.x, this.y, this.z); }
vec3.prototype.normalized = function() { return new vec3(this.x / this.magnitude(), this.y / this.magnitude(), this.z / this.magnitude()); };
vec3.prototype.rounded = vec3.prototype.round = function() { return vec3(Math.round(this.x), Math.round(this.y), Math.round(this.z)); };
vec3.prototype.floored = vec3.prototype.floor = function() { return vec3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)); };
vec3.prototype.ceiled = vec3.prototype.ceil = function() { return vec3(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z)); };
vec3.prototype.abs = function() { return vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z)); };
vec3.prototype.cross = function(other) {
    other = vec3(other);
    return vec3(
        this.y * other.z - this.z * other.y,
        this.z * other.x - this.x * other.z,
        this.x * other.y - this.y * other.x
    );
    return vec3(
        this.z * other.y - this.y * other.z,
        this.x * other.z - this.z * other.x,
        this.y * other.x - this.x * other.y
    );
};

vec3.prototype.rotated = function(axis, angle) {
    let na = axis.normalized()
    // Rodrigues style formula, rotate only the perpendicular component of the vec3
    let xb = vec3(na.y,na.x,na.z);
    let yb = vec3(na.x,na.z,na.y);
    vec2()
}

function vec4(...args) {
    let [x, y, z, w] = args.map(tryVecToArray).flat(Infinity)
    if (!(this instanceof vec4)) return new vec4(x, y, z, w);
    this.x = x || 0; this.y = y || 0; this.z = z || 0; this.w = w || 0;
}

vec3.prototype.duplicate = function() { return vec4(this.x, this.y, this.z, this.w); }

// mat3

function mat3(col1, col2, col3) {
    if (!(this instanceof mat3)) return new mat3(col1, col2, col3);
    this.col1 = vec3(col1 || [1,0,0]);
    this.col2 = vec3(col2 || [0,1,0]);
    this.col3 = vec3(col3 || [0,0,1]);
}

mat3.prototype.multiply = function(otherMat) {
    if (!(otherMat instanceof mat3)) {
        throw new Error("You can only multiply a mat3 with another mat3.");
    }

    const a = this;
    const b = otherMat;

    const result = new mat3(
        vec3(
            a.col1.x * b.col1.x + a.col2.x * b.col1.y + a.col3.x * b.col1.z,
            a.col1.y * b.col1.x + a.col2.y * b.col1.y + a.col3.y * b.col1.z,
            a.col1.z * b.col1.x + a.col2.z * b.col1.y + a.col3.z * b.col1.z
        ),
        vec3(
            a.col1.x * b.col2.x + a.col2.x * b.col2.y + a.col3.x * b.col2.z,
            a.col1.y * b.col2.x + a.col2.y * b.col2.y + a.col3.y * b.col2.z,
            a.col1.z * b.col2.x + a.col2.z * b.col2.y + a.col3.z * b.col2.z
        ),
        vec3(
            a.col1.x * b.col3.x + a.col2.x * b.col3.y + a.col3.x * b.col3.z,
            a.col1.y * b.col3.x + a.col2.y * b.col3.y + a.col3.y * b.col3.z,
            a.col1.z * b.col3.x + a.col2.z * b.col3.y + a.col3.z * b.col3.z
        )
    );

    return result;
};

mat3.prototype.multiplyVec3 = function(vec) {
    return vec3(
        this.col1.x * vec.x + this.col2.x * vec.y + this.col3.x * vec.z,
        this.col1.y * vec.x + this.col2.y * vec.y + this.col3.y * vec.z,
        this.col1.z * vec.x + this.col2.z * vec.y + this.col3.z * vec.z
    );
};

mat3.prototype.transpose = function() {
    return mat3(
        vec3(this.col1.x, this.col2.x, this.col3.x),
        vec3(this.col1.y, this.col2.y, this.col3.y),
        vec3(this.col1.z, this.col2.z, this.col3.z)
    );
};

mat3.prototype.determinant = function() {
    return this.col1.x * (this.col2.y * this.col3.z - this.col2.z * this.col3.y) -
           this.col2.x * (this.col1.y * this.col3.z - this.col1.z * this.col3.y) +
           this.col3.x * (this.col1.y * this.col2.z - this.col1.z * this.col2.y);
};

mat3.prototype.inverse = function() {
    let a = this.col1.x, b = this.col1.y, c = this.col1.z;
    let d = this.col2.x, e = this.col2.y, f = this.col2.z;
    let g = this.col3.x, h = this.col3.y, i = this.col3.z;

    let det = a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
    if (det === 0) return null; // Non-invertible matrix

    let adj = new mat3(
        vec3(
            +(e*i - f*h),
            -(d*i - f*g),
            +(d*h - e*g)
        ),
        vec3(
            -(b*i - c*h),
            +(a*i - c*g),
            -(a*h - b*g)
        ),
        vec3(
            +(b*f - c*e),
            -(a*f - c*d),
            +(a*e - b*d)
        )
    );

    // Divide adjugate matrix by determinant
    for (let col of [adj.col1, adj.col2, adj.col3]) {
        col.x /= det;
        col.y /= det;
        col.z /= det;
    }

    return adj;
};

// mat4

function mat4(col1, col2, col3, col4) {
    if (!(this instanceof mat4)) return new mat4(col1, col2, col3, col4);

    this.col1 = vec4(col1 || [1,0,0,0]);
    this.col2 = vec4(col2 || [0,1,0,0]);
    this.col3 = vec4(col3 || [0,0,1,0]);
    this.col4 = vec4(col4 || [0,0,0,1]);
}

mat4.prototype.multiply = function(otherMat) {
    if (!(otherMat instanceof mat4)) {
        throw new Error("You can only multiply a mat4 with another mat4.");
    }

    const a = this;
    const b = otherMat;

    const result = new mat4(
        vec4(
            a.col1.x * b.col1.x + a.col2.x * b.col1.y + a.col3.x * b.col1.z + a.col4.x * b.col1.w,
            a.col1.y * b.col1.x + a.col2.y * b.col1.y + a.col3.y * b.col1.z + a.col4.y * b.col1.w,
            a.col1.z * b.col1.x + a.col2.z * b.col1.y + a.col3.z * b.col1.z + a.col4.z * b.col1.w,
            a.col1.w * b.col1.x + a.col2.w * b.col1.y + a.col3.w * b.col1.z + a.col4.w * b.col1.w
        ),
        vec4(
            a.col1.x * b.col2.x + a.col2.x * b.col2.y + a.col3.x * b.col2.z + a.col4.x * b.col2.w,
            a.col1.y * b.col2.x + a.col2.y * b.col2.y + a.col3.y * b.col2.z + a.col4.y * b.col2.w,
            a.col1.z * b.col2.x + a.col2.z * b.col2.y + a.col3.z * b.col2.z + a.col4.z * b.col2.w,
            a.col1.w * b.col2.x + a.col2.w * b.col2.y + a.col3.w * b.col2.z + a.col4.w * b.col2.w
        ),
        vec4(
            a.col1.x * b.col3.x + a.col2.x * b.col3.y + a.col3.x * b.col3.z + a.col4.x * b.col3.w,
            a.col1.y * b.col3.x + a.col2.y * b.col3.y + a.col3.y * b.col3.z + a.col4.y * b.col3.w,
            a.col1.z * b.col3.x + a.col2.z * b.col3.y + a.col3.z * b.col3.z + a.col4.z * b.col3.w,
            a.col1.w * b.col3.x + a.col2.w * b.col3.y + a.col3.w * b.col3.z + a.col4.w * b.col3.w
        ),
        vec4(
            a.col1.x * b.col4.x + a.col2.x * b.col4.y + a.col3.x * b.col4.z + a.col4.x * b.col4.w,
            a.col1.y * b.col4.x + a.col2.y * b.col4.y + a.col3.y * b.col4.z + a.col4.y * b.col4.w,
            a.col1.z * b.col4.x + a.col2.z * b.col4.y + a.col3.z * b.col4.z + a.col4.z * b.col4.w,
            a.col1.w * b.col4.x + a.col2.w * b.col4.y + a.col3.w * b.col4.z + a.col4.w * b.col4.w
        )
    );

    return result;
};

mat4.prototype.multiplyVec3 = function(vec) {
    vec = vec4(vec.x, vec.y, vec.z)
    return vec3(
        this.col1.x * vec.x + this.col2.x * vec.y + this.col3.x * vec.z + this.col4.x * vec.w,
        this.col1.y * vec.x + this.col2.y * vec.y + this.col3.y * vec.z + this.col4.y * vec.w,
        this.col1.z * vec.x + this.col2.z * vec.y + this.col3.z * vec.z + this.col4.z * vec.w
    );
};

mat4.prototype.multiplyVec4 = function(vec) {
    return vec4(
        this.col1.x * vec.x + this.col2.x * vec.y + this.col3.x * vec.z + this.col4.x * vec.w,
        this.col1.y * vec.x + this.col2.y * vec.y + this.col3.y * vec.z + this.col4.y * vec.w,
        this.col1.z * vec.x + this.col2.z * vec.y + this.col3.z * vec.z + this.col4.z * vec.w,
        this.col1.w * vec.x + this.col2.w * vec.y + this.col3.w * vec.z + this.col4.w * vec.w
    );
};

mat4.prototype.transpose = function() {
    return mat4(
        vec4(this.col1.x, this.col2.x, this.col3.x, this.col4.x),
        vec4(this.col1.y, this.col2.y, this.col3.y, this.col4.y),
        vec4(this.col1.z, this.col2.z, this.col3.z, this.col4.z),
        vec4(this.col1.w, this.col2.w, this.col3.w, this.col4.w)
    );
};

mat4.prototype.determinant = function() {
    let a = this.col1.x, b = this.col1.y, c = this.col1.z, d = this.col1.w;
    let e = this.col2.x, f = this.col2.y, g = this.col2.z, h = this.col2.w;
    let i = this.col3.x, j = this.col3.y, k = this.col3.z, l = this.col3.w;
    let m = this.col4.x, n = this.col4.y, o = this.col4.z, p = this.col4.w;

    let det1 = k * p - o * l;
    let det2 = j * p - n * l;
    let det3 = j * o - n * k;
    let det4 = i * p - m * l;
    let det5 = i * o - m * k;
    let det6 = i * n - m * j;

    return a * (f * det1 - g * det2 + h * det3) -
           b * (e * det1 - g * det4 + h * det5) +
           c * (e * det2 - f * det4 + h * det6) -
           d * (e * det3 - f * det5 + g * det6);
};

mat4.prototype.inverse = function() {
    let a = this.col1.x, b = this.col1.y, c = this.col1.z, d = this.col1.w;
    let e = this.col2.x, f = this.col2.y, g = this.col2.z, h = this.col2.w;
    let i = this.col3.x, j = this.col3.y, k = this.col3.z, l = this.col3.w;
    let m = this.col4.x, n = this.col4.y, o = this.col4.z, p = this.col4.w;

    let det = this.determinant();
    if (det === 0) return null; // Non-invertible matrix

    // Adjugate and determinant
    let adj = new mat4(
        vec4(
            +(f * k * p - f * l * o - j * g * p + j * h * o + n * g * l - n * h * k),
            -(b * k * p - b * l * o - j * c * p + j * d * o + n * c * l - n * d * k),
            +(b * g * p - b * h * o - f * c * p + f * d * o + n * c * h - n * d * g),
            -(b * g * l - b * h * k - f * c * l + f * d * k + j * c * h - j * d * g)
        ),
        vec4(
            -(e * k * p - e * l * o - i * g * p + i * h * o + m * g * l - m * h * k),
            +(a * k * p - a * l * o - i * c * p + i * d * o + m * c * l - m * d * k),
            -(a * g * p - a * h * o - e * c * p + e * d * o + m * c * h - m * d * g),
            +(a * g * l - a * h * k - e * c * l + e * d * k + i * c * h - i * d * g)
        ),
        vec4(
            +(e * j * p - e * l * n - i * f * p + i * h * n + m * f * l - m * h * j),
            -(a * j * p - a * l * n - i * b * p + i * d * n + m * b * l - m * d * j),
            +(a * f * p - a * h * n - e * b * p + e * d * n + m * b * h - m * d * f),
            -(a * f * l - a * h * j - e * b * l + e * d * j + i * b * h - i * d * f)
        ),
        vec4(
            -(e * j * o - e * k * n - i * f * o + i * g * n + m * f * k - m * g * j),
            +(a * j * o - a * k * n - i * b * o + i * c * n + m * b * k - m * c * j),
            -(a * f * o - a * g * n - e * b * o + e * c * n + m * b * g - m * c * f),
            +(a * f * k - a * g * j - e * b * k + e * c * j + i * b * g - i * c * f)
        )
    );

    // Divide adjugate matrix by determinant
    for (let col of [adj.col1, adj.col2, adj.col3, adj.col4]) {
        col.x /= det;
        col.y /= det;
        col.z /= det;
        col.w /= det;
    }

    return adj;
};

// mat3x4. used as a transform so has a bunch of utility functions

function mat3x4(col1, col2, col3, col4) {
    if (!(this instanceof mat3x4)) return new mat3x4(col1, col2, col3, col4);
    col1 = vec3(col1 || [1,0,0]);
    col2 = vec3(col2 || [0,1,0]);
    col3 = vec3(col3 || [0,0,1]);
    col4 = vec3(col4 || [0,0,0]);
    this.matrix = new mat4(vec4(col1, 0), vec4(col2, 0), vec4(col3, 0), vec4(col4, 1));
}

mat3x4.prototype.getOrigin = function() {
    return vec3(this.matrix.col4.x, this.matrix.col4.y, this.matrix.col4.z);
};

mat3x4.prototype.setOrigin = function(vec) {
    vec = vec3(vec)
    this.matrix.col4 = vec4(vec.x, vec.y, vec.z, 1);
};

mat3x4.prototype.setBasis = function(basis) {
    this.matrix.col1 = vec4(basis.col1.x, basis.col1.y, basis.col1.z, 0);
    this.matrix.col2 = vec4(basis.col2.x, basis.col2.y, basis.col2.z, 0);
    this.matrix.col3 = vec4(basis.col3.x, basis.col3.y, basis.col3.z, 0);
};

mat3x4.prototype.getBasis = function() {
    return mat3(
        vec3(this.matrix.col1.x, this.matrix.col1.y, this.matrix.col1.z),
        vec3(this.matrix.col2.x, this.matrix.col2.y, this.matrix.col2.z),
        vec3(this.matrix.col3.x, this.matrix.col3.y, this.matrix.col3.z)
    );
};

mat3x4.prototype.inverse = function() {
    let inv_4x4 = this.matrix.inverse()
    return mat3x4(
        inv_4x4.col1.xyz,
        inv_4x4.col2.xyz,
        inv_4x4.col3.xyz,
        inv_4x4.col4.xyz
    );
};

mat3x4.prototype.multiplyVec3 = function(vec) {
    return this.getBasis().multiplyVec3(vec).add(this.matrix.col4.xyz);
};

mat3x4.prototype.multiply = function(otherMat) {
    if (!(otherMat instanceof mat3x4)) {
        throw new Error("You can only multiply a mat3x4 with another mat3x4.");
    }
    otherMat = otherMat.matrix
    this.matrix = this.matrix.multiply(mat4(otherMatrix.col1, otherMatrix.col2, otherMatrix.col3, otherMatrix.col1, otherMatrix.col4))
};

mat3x4.prototype.rotated = function(axis, angle) {
    // Create a rotation matrix based on the Rodrigues' rotation formula
    let cosTheta = Math.cos(angle);
    let sinTheta = Math.sin(angle);
    let rotationMatrix = mat3(
        vec3(
            cosTheta + (1 - cosTheta) * axis.x * axis.x,
            (1 - cosTheta) * axis.x * axis.y - sinTheta * axis.z,
            (1 - cosTheta) * axis.x * axis.z + sinTheta * axis.y
        ),
        vec3(
            (1 - cosTheta) * axis.y * axis.x + sinTheta * axis.z,
            cosTheta + (1 - cosTheta) * axis.y * axis.y,
            (1 - cosTheta) * axis.y * axis.z - sinTheta * axis.x
        ),
        vec3(
            (1 - cosTheta) * axis.z * axis.x - sinTheta * axis.y,
            (1 - cosTheta) * axis.z * axis.y + sinTheta * axis.x,
            cosTheta + (1 - cosTheta) * axis.z * axis.z
        )
    );

    // Multiply the rotation matrix with the current basis
    let newBasis = this.getBasis().multiply(rotationMatrix);

    // Create a new mat3x4 with the updated basis and the same origin
    return new mat3x4(
        newBasis.col1,
        newBasis.col2,
        newBasis.col3,
        this.getOrigin()
    );
};

mat3x4.prototype.scaled = function(scale) {
    // If scale is a single value, create a vec3 with the same value for uniform scaling
    if (typeof scale === 'number') {
        scale = new vec3(scale, scale, scale);
    } else if (Array.isArray(scale)) {
        scale = new vec3(scale);
    }

    return mat3x4(
        vec3(this.matrix.col1).scaled(scale),
        vec3(this.matrix.col2).scaled(scale),
        vec3(this.matrix.col3).scaled(scale),
        this.matrix.col4 // Since using this as a transform, not scaling the translate
        //vec3(this.matrix.col4).scaled(scale)
    );
};

mat3x4.prototype.translated = function(translate) {
    if (Array.isArray(translate)) {
        translate = new vec3(translate);
    }

    return mat3x4(
        this.matrix.col1,
        this.matrix.col2,
        this.matrix.col3,
        vec3(this.matrix.col4).add(translate)
    );
};

ez.worldToScreen = function(point, objectTransform) {
    // Apply object/model transform to get world coordinates
    objectTransform = (objectTransform || mat3x4());
    point = objectTransform.multiplyVec3(point);
    // Apply camera transform. First translate/move the world around according to the camera pos in the world
    let cameraSpacePos = point.sub(ez.camera.getOrigin());
    // Then, scale and rotate that world with the camera as the origin point to get our rotated camera perspective. W component is 0 to mute any translation
    let invCameraBasis = ez.camera.getBasis().inverse();
    cameraSpacePos = invCameraBasis.multiplyVec3(cameraSpacePos);

    let screenSpacePos = vec3(cameraSpacePos);
    if(ez.useProjectionMatrix) {
        // Construct the projection mat from fov, aspect ratio, near plane distance, and far plane distance
        let projectionMat = ez.projectionMatrixOverride || ez.createProjectionMatrix(deg_to_rad(90), ez.canvas.height / ez.canvas.width, 1, 1000);
        // After the projection matrix is applied, it's called 'view space.' We still need to divide by w (original z coordinate) to apply perspective/vanishing point
        let viewSpacePos = projectionMat.multiplyVec4(vec4(cameraSpacePos, 1.0));
        // Apply perspective divide
        console.log(viewSpacePos.w) // Just printing 0 always
        let clipSpacePos = vec3(viewSpacePos.xyz).divide(viewSpacePos.w);
        // Clip space is normalized between -1 and 1 on all axes, so to get back to screen size, multiply by half width and half height
        let perspectiveScreenSpacePos = vec2(clipSpacePos.xy).multiply(vec2(ez.canvas.width/2, ez.canvas.height/2))

        // Coerece to interpolation value if bool, allows for effects like smoothly transitioning from a 2D view to a 3D view
        let interp = +ez.useProjectionMatrix || 0
        // Interpolate between no projection matrix applied and resulting application value
        screenSpacePos.x = lerpClamp(screenSpacePos.x, perspectiveScreenSpacePos.x, interp);
        screenSpacePos.y = lerpClamp(screenSpacePos.y, perspectiveScreenSpacePos.y, interp);
        screenSpacePos.z = lerpClamp(screenSpacePos.z, perspectiveScreenSpacePos.z, interp);
    }
    if(ez.centerOrigin) {
        screenSpacePos = screenSpacePos.add(vec3(ez.canvas.width/2, ez.canvas.height/2, 0))
    }
    return screenSpacePos;
}
ez.screenToWorld = function(pos) {
    pos = vec3(vec2(pos).xy, 0);
    if(ez.centerOrigin) {
        pos = pos.add(vec3(-ez.canvas.width/2, -ez.canvas.height/2))
    }
    pos = ez.camera.getBasis().multiplyVec3(pos);
    pos = vec2(pos.add(ez.camera.getOrigin()).xy)
    return pos
    // settings for camera, ndc, perspective divide, etc
}

ez.createProjectionMatrix = function(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1 / (near - far);

    return new mat4(
        [f / aspect, 0, 0, 0],
        [0, f, 0, 0],
        [0, 0, (near + far) * rangeInv, -1],
        [0, 0, near * far * rangeInv * 2, 0]
    );
}

ez.getMousePosWorld = function() {
    let pos = vec3(ez.mousePos.x, ez.mousePos.y, 0);
    return ez.screenToWorld(pos);
}

///////////////////////
// GLOBAL MATH UTILS //
///////////////////////

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerpClamp(a, b, t) {
    return clamp(lerp(a, b, t), Math.min(a, b), Math.max(a, b));
}

function step(edge, value) {
    return value < edge ? 0 : 1;
}

function smoothstep(edge0, edge1, value) {
    let t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3 - 2 * t);
}

////////////////////////////
// MISC UTILITY FUNCTIONS //
////////////////////////////

// Object to store the observed variables' states
const smoothedVariables = {};

// Smoothly interpolates between values over time
ez.smoothVar = function(key, newValue = undefined, duration = 1000) {
    const currentTime = Date.now();
    
    // Initialize or update the tracking object for the specified key
    if (newValue !== undefined) {
        // If it's a new or updated target value
        if (!smoothedVariables[key] || smoothedVariables[key].targetValue !== newValue) {
            smoothedVariables[key] = {
                startValue: smoothedVariables[key]?.currentValue || 0,
                currentValue: smoothedVariables[key]?.currentValue || 0,
                targetValue: newValue,
                startTime: currentTime,
                endTime: currentTime + duration
            };
        }
    }
    
    // If the key is not being tracked, return 0 as a default value
    if (!smoothedVariables[key]) {
        return 0;
    }

    // Calculate the current interpolation value if within the transition period
    if (currentTime < smoothedVariables[key].endTime) {
        const elapsedTime = currentTime - smoothedVariables[key].startTime;
        const totalDuration = smoothedVariables[key].endTime - smoothedVariables[key].startTime;
        const progress = elapsedTime / totalDuration;
        
        // Linear interpolation formula: startValue + progress * (endValue - startValue)
        smoothedVariables[key].currentValue = smoothedVariables[key].startValue + 
                                              progress * (smoothedVariables[key].targetValue - smoothedVariables[key].startValue);
    } else {
        // If the transition period has ended, ensure the current value matches the target value
        smoothedVariables[key].currentValue = smoothedVariables[key].targetValue;
    }
    
    return smoothedVariables[key].currentValue;
}

function tryVecToArray(vec) {
    if (vec === undefined) return vec
    let arr = [vec.x, vec.y, vec.z, vec.w].filter(e => e !== undefined)
    return arr.length > 0 ? arr : vec
}

function deg_to_rad(degrees) {
    return degrees * (Math.PI / 180);
}

function rad_to_deg(radians) {
    return radians * (180 / Math.PI);
}

ez.bresenhamLineConnect = function(pointA, pointB) {
    let points = [];

    let x0 = pointA.x, y0 = pointA.y;
    let x1 = pointB.x, y1 = pointB.y;

    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, e2; 

    while (true) {
        points.push(new vec2(x0, y0));
        if (x0 === x1 && y0 === y1) break;
        e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }

    return points;
};

ez.smoothPoints = function(points, options = {}) {
    const iterations = options.iterations || 5; // Number of smoothing iterations
    const smoothingFactor = options.smoothingFactor || 0.25; // Factor for corner cutting

    let smoothedPoints = points.slice(); // Copy the original points array

    for (let it = 0; it < iterations; it++) {
        let newPoints = [];
        for (let i = 0; i < smoothedPoints.length - 1; i++) {
            const p0 = smoothedPoints[i];
            const p1 = smoothedPoints[i + 1];

            // Calculate the first new point
            const q = new vec2(
                p0.x + smoothingFactor * (p1.x - p0.x),
                p0.y + smoothingFactor * (p1.y - p0.y)
            );

            // Calculate the second new point
            const r = new vec2(
                p1.x - smoothingFactor * (p1.x - p0.x),
                p1.y - smoothingFactor * (p1.y - p0.y)
            );

            newPoints.push(q);

            if (i === smoothedPoints.length - 2) { // If it's the last iteration, add the second new point
                newPoints.push(r);
            }
        }

        // If it's not the first iteration, add the very first point of the previous smoothedPoints
        // because the algorithm "eats away" the start and end of the line over iterations
        if (it !== 0) {
            newPoints.unshift(smoothedPoints[0]);
        }
        
        // Similarly, add the very last point of the previous smoothedPoints to the end
        newPoints.push(smoothedPoints[smoothedPoints.length - 1]);

        smoothedPoints = newPoints;
    }

    return smoothedPoints;
}

ez.centerCamera = function() {
    ez.camera.setOrigin(vec3(-ez.canvas.width/2, ez.canvas.height/2, 0))
}

ez.makeVecBarycentric = function(p, a, b, c) {
    const v0x = b.x - a.x, v0y = b.y - a.y;
    const v1x = c.x - a.x, v1y = c.y - a.y;
    const v2x = p.x - a.x, v2y = p.y - a.y;

    const d00 = v0x * v0x + v0y * v0y;
    const d01 = v0x * v1x + v0y * v1y;
    const d11 = v1x * v1x + v1y * v1y;
    const d20 = v2x * v0x + v2y * v0y;
    const d21 = v2x * v1x + v2y * v1y;

    const denom = d00 * d11 - d01 * d01;
    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1.0 - v - w;

    return {u, v, w};
};

// Was getting bottlenecked by ctx.getImageData on large canvas so came up with this to draw triangles faster
ez._blitCanvasSizes = [10, 20, 30, 40, 50, 100, 150, 200, 250, 500];
ez._blitCanvasCache = new Map();

// Function to select or create the appropriate canvas based on requested size
ez._getMiniCanvasForBlit = function(width, height) {
    // Find the smallest canvas size that fits the requested dimensions
    const sizeNeeded = Math.max(width, height);
    const selectedSize = ez._blitCanvasSizes.find(size => size >= sizeNeeded);
    if (!selectedSize) {
        throw new Error("Requested size exceeds maximum predefined canvas size.");
    }

    // Check if the canvas of the selected size is already created, if not, create it
    if (!ez._blitCanvasCache.has(selectedSize)) {
        const canvas = document.createElement("canvas");
        canvas.width = selectedSize;
        canvas.height = selectedSize;
        const ctx = canvas.getContext("2d", {willReadFrequently: true});
        // Initialize canvas with a clear state
        ctx.clearRect(0, 0, selectedSize, selectedSize);
        ez._blitCanvasCache.set(selectedSize, { canvas, ctx });
    }

    const { canvas, ctx } = ez._blitCanvasCache.get(selectedSize);
    // Clear the canvas to ensure it's ready for new drawing operations
    ctx.clearRect(0, 0, selectedSize, selectedSize);
    const canvasImageData = ctx.getImageData(0, 0, selectedSize, selectedSize);
    return [canvas, ctx, canvasImageData];
};


ez.drawTriangle = function(canvas, ctx, p0, p1, p2, color0="#000", color1="#000", color2="#000") {
    color0 = ez.parseColorAsRGBAObj(color0);
    color1 = ez.parseColorAsRGBAObj(color1);
    color2 = ez.parseColorAsRGBAObj(color2);

    var pointsAndColors = [{point: p0, color: color0}, {point: p1, color: color1}, {point: p2, color: color2}];

    // Sort points (and their colors) by y-coordinate
    pointsAndColors.sort((a, b) => a.point.y - b.point.y);

    // Unpack sorted points and colors
    [p0, p1, p2] = pointsAndColors.map(pc => vec2(pc.point).floor());
    [color0, color1, color2] = pointsAndColors.map(pc => pc.color);

    let blitCanvas, blitCtx, imgData
    let minX = Math.min(p0.x, p1.x, p2.x);
    let minY = Math.min(p0.y, p1.y, p2.y);
    let maxX = Math.max(p0.x, p1.x, p2.x);
    let maxY = Math.max(p0.y, p1.y, p2.y);
    if(Math.max(maxX + 1 - minX, maxY + 1 - minY) <= ez._blitCanvasSizes[ez._blitCanvasSizes.length - 1]) {
        [blitCanvas, blitCtx, imgData] = ez._getMiniCanvasForBlit(maxX + 1 - minX, maxY + 1 - minY);
        p0 = p0.sub([minX, minY]);
        p1 = p1.sub([minX, minY]);
        p2 = p2.sub([minX, minY]);
    }
    else {
        blitCanvas = canvas
        blitCtx = ctx
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    var pixels = imgData.data;

    const interpolate = function(p1, p2, y) {
        if (p1.y === p2.y) return p1.x;
        return ((y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y) + p1.x;
    };

    // Pre-calculate vector components for barycentric coordinates outside the loop
    const v0x = p1.x - p0.x, v0y = p1.y - p0.y;
    const v1x = p2.x - p0.x, v1y = p2.y - p0.y;
    const d00 = v0x * v0x + v0y * v0y;
    const d01 = v0x * v1x + v0y * v1y;
    const d11 = v1x * v1x + v1y * v1y;
    const denom = d00 * d11 - d01 * d01; // This stays constant for all pixels

    // Draw from top to bottom using scanline algorithm
    for (let y = p0.y; y <= p2.y; y++) {
        var x0 = interpolate(p0, p2, y);
        var x1 = (y < p1.y) ? interpolate(p0, p1, y) : interpolate(p1, p2, y);

        if (x0 > x1) [x0, x1] = [x1, x0]; // Swap if x0 is to the right of x1

        for (let x = Math.ceil(x0); x <= x1; x++) {
            const v2x = x - p0.x, v2y = y - p0.y;
            const d20 = v2x * v0x + v2y * v0y;
            const d21 = v2x * v1x + v2y * v1y;
            const v = (d11 * d20 - d01 * d21) / denom;
            const w = (d00 * d21 - d01 * d20) / denom;
            const u = 1.0 - v - w;

            const r = u * color0.r + v * color1.r + w * color2.r;
            const g = u * color0.g + v * color1.g + w * color2.g;
            const b = u * color0.b + v * color1.b + w * color2.b;

            const index = (x + y * imgData.width) * 4;
            pixels[index] = r;
            pixels[index + 1] = g;
            pixels[index + 2] = b;
            pixels[index + 3] = 255;
        }
    }

    if(canvas === blitCanvas) {
        ctx.putImageData(imgData, 0, 0);
    }
    else {
        blitCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(blitCanvas, minX, minY);
    }
};

// Create a canvas element dynamically
ez._parseColorCanvas = document.createElement('canvas');
ez._parseColorCanvas.width = 1;
ez._parseColorCanvas.height = 1;
ez._parseColorCanvasCtx = ez._parseColorCanvas.getContext('2d', {willReadFrequently: true});

ez.parseColor = function(color) {
    // Check if the input is a valid hexadecimal number
    if (!isNaN(color) && color >= 0 && color <= 0xFFFFFF) {
        return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
    }

    // Try setting the color and filling a rectangle to sample the color
    try {
        //ez._parseColorCanvasCtx.clearRect(0,0,1,1);
        ez._parseColorCanvasCtx.clearRect(0,0,1,1);
        ez._parseColorCanvasCtx.fillStyle = color;
        ez._parseColorCanvasCtx.fillRect(0, 0, 1, 1);
        var imageData = ez._parseColorCanvasCtx.getImageData(0, 0, 1, 1).data;
        
        // Convert the RGBA color from the canvas to a hex string
        var hexColor = "#" + ((1 << 24) + (imageData[0] << 16) + (imageData[1] << 8) + imageData[2]).toString(16).slice(1).toUpperCase();
        return hexColor;
    } catch (e) {
        // If there's an error (invalid color), return black
        console.error("Error parsing color:", e);
        return "#000000";
    }
};

ez.parseColorAsRGBAObj = function(color) {
    let hexStr = ez.parseColor(color); // Assuming it returns a hex string like "#rrggbbaa" or "#rrggbb"

    // Remove the '#' character if present
    if (hexStr.startsWith('#')) {
        hexStr = hexStr.substring(1);
    }

    // Parse the r, g, b values from the hex string
    let r = parseInt(hexStr.substring(0, 2), 16);
    let g = parseInt(hexStr.substring(2, 4), 16);
    let b = parseInt(hexStr.substring(4, 6), 16);
    let a = hexStr.length === 8 ? parseInt(hexStr.substring(6, 8), 16) / 255 : 1;

    // Return the RGB object
    return { r, g, b, a };
}

// Shorthand hacks for each draw type. fillAndStroke and allow passing in color for each.
Object.entries(ez).forEach(([key,value]) => {
    if(typeof value === "function" && value.prototype) {
        if(value.prototype.drawPath && !value.prototype.fill && !value.prototype.stroke && !value.prototype.fillAndStroke) {
            value.prototype.fill = function(color) {
                this.drawPath();
                ez.ctx.fill();
            }
            value.prototype.stroke = function(color) {
                this.drawPath();
                ez.ctx.stroke();
            }
            value.prototype.fillAndStroke = function(fillColor, strokeColor) {
                this.drawPath();
                ez.ctx.fill();
                ez.ctx.stroke();
            }
        }

        if(value.prototype.fill) {
            let prevFill = value.prototype.fill
            value.prototype.fill = function(color = undefined, ctxOptions = {}) {
                ez.ctx.save()
                ez.ctx.fillStyle = color !== undefined ? ez.parseColor(color) : ez.ctx.fillStyle
                Object.entries(ctxOptions).forEach(([opt, val]) => ez.ctx[opt] = val)
                prevFill.bind(this)(color)
                ez.ctx.restore()
            }
        }

        if(value.prototype.stroke) {
            let prevStroke = value.prototype.stroke
            value.prototype.stroke = function(color = undefined, ctxOptions = {}) {
                ez.ctx.save()
                ez.ctx.strokeStyle = color !== undefined ? ez.parseColor(color) : ez.ctx.strokeStyle
                Object.entries(ctxOptions).forEach(([opt, val]) => ez.ctx[opt] = val)
                prevStroke.bind(this)(color)
                ez.ctx.restore()
            }
        }

        if(value.prototype.fillAndStroke) {
            let prevFillAndStroke = value.prototype.fillAndStroke
            value.prototype.fillAndStroke = function(fillColor = undefined, strokeColor = undefined, ctxOptions = {}) {
                ez.ctx.save()
                ez.ctx.fillStyle = fillColor !== undefined ? ez.parseColor(fillColor) : ez.ctx.fillStyle
                ez.ctx.strokeStyle = strokeColor !== undefined ? ez.parseColor(strokeColor) : ez.ctx.strokeStyle
                Object.entries(ctxOptions).forEach(([opt, val]) => ez.ctx[opt] = val)
                prevFillAndStroke.bind(this)(fillColor, strokeColor)
                ez.ctx.restore()
            }
        }

        if(value.prototype.fill && value.prototype.stroke && !value.prototype.fillAndStroke) {
            value.prototype.fillAndStroke = function(fillColor, strokeColor, ctxOptions) {
                this.fill(fillColor, ctxOptions)
                this.stroke(strokeColor, ctxOptions)
            }
        }
    }
})

// Swizzles for vectors so we can use them like vec4.xyz and vec3.zyx, or setters like vec3.xzy = [1,2,3] like how you can in shaders
ez.defineSwizzles = function(obj, ...propertyList) {
    function* generateCombinations(arr, length) {
        if (length === 1) {
            for (const item of arr) {
                yield [item];
            }
        } else {
            for (let i = 0; i < arr.length; i++) {
                const first = arr[i];
                const remainingCombinations = generateCombinations(arr, length - 1);
                for (const combination of remainingCombinations) {
                    yield [first, ...combination];
                }
            }
        }
    }

    for (let len = 2; len <= propertyList.length; len++) {
        for (const combination of generateCombinations(propertyList, len)) {
            const propName = combination.join('');
            Object.defineProperty(obj, propName, {
                get: function() {
                    return combination.map(prop => this[prop]);
                },
                set: function(value) {
                    combination.forEach((e, i) => this[e] = vec4(value).xyzw[i]);
                }
            });
        }
    }
}

ez.defineSwizzles(vec2.prototype, 'x', 'y', 'z', 'w')
ez.defineSwizzles(vec3.prototype, 'x', 'y', 'z', 'w')
ez.defineSwizzles(vec4.prototype, 'x', 'y', 'z', 'w')

// Hack so I don't have to call _update before every draw call etc. Any function you call automatically sets up ez
Object.entries(ez).forEach(([key,value]) => {
    if(typeof value === "function" && !["_update", "createCanvasAndAddToPage", "addInputEventListeners"].includes(key)) {
        ez[key] = (...args) => {
            ez._update();
            return value(...args);
        }
    }
})
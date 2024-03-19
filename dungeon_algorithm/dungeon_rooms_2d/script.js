const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
canvas.imageSmoothingEnabled = false;

let boxes = [];
let corridors = [];
let floodFill = [];
let failPoints = [];

const map_width = 50;
const map_height = 50;

const TOP = 0b000001;
const BOTTOM = 0b000010;
const RIGHT = 0b000100;
const LEFT = 0b001000;
const ALL_DIRS = TOP | BOTTOM | RIGHT | LEFT;

function toCanvasX(coord) {
    return (coord / map_width) * canvas.width;
}
function toCanvasY(coord) {
    return (coord / map_height) * canvas.height;
}

function randomInt(min, max) {
    // Ensure min and max are whole numbers and min is not greater than max
    min = Math.ceil(min);
    max = Math.floor(max);

    // Generate a random number between min and max, inclusive
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nonzero_sign(i) {
    return i >= 0 ? 1 : -1;
}

function drawGrid(centerX, centerY, spacing) {
    ctx.fillStyle = "white";
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    var curX = centerX;
    var curY = centerY;
    while (curX < canvas.width) {
        ctx.beginPath();
        ctx.moveTo(curX, 0);
        ctx.lineTo(curX, canvas.height);
        ctx.stroke();
        curX += spacing;
    }
    curX = centerX;
    while (curX >= 0) {
        ctx.beginPath();
        ctx.moveTo(curX, 0);
        ctx.lineTo(curX, canvas.height);
        ctx.stroke();
        curX -= spacing;
    }
    curX = centerX;
    while (curY < canvas.height) {
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(canvas.width, curY);
        ctx.stroke();
        curY += spacing;
    }
    curY = centerY;
    while (curY >= 0) {
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(canvas.width, curY);
        ctx.stroke();
        curY -= spacing;
    }
}

class Box {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.doors = []; // indicates the door positions, if any. format is [direction, index, is_optional]
        this.does_overlap = false;
        this.separateCount = 0;
        this.doorMargin = 1;
    }

    setRandomDoors() {
        [TOP, BOTTOM, RIGHT, LEFT].forEach((dir) => {
            for (let i = 0; i < 2; i++) {
                let doorPos = randomInt(0, dir & (TOP | BOTTOM) ? this.width - 1 : this.height - 1);
                if (this.doors.find((d) => d[0] === dir && d[1] === doorPos)) continue;
                this.doors.push([dir, doorPos, Math.random() < 0.5]);
            }
        });
    }

    getDoorMargin(dir) {
        let margin = this.doorMargin;
        // No margin necessary if there is no door on this side
        if (!this.doors.some(([direction, pos, is_optional]) => direction === dir && !is_optional)) margin = 0;
        return margin;
    }

    calculateAABB() {
        let l_margin = this.getDoorMargin(LEFT);
        let r_margin = this.getDoorMargin(RIGHT);
        let t_margin = this.getDoorMargin(TOP);
        let b_margin = this.getDoorMargin(BOTTOM);
        this.minX = this.x - l_margin;
        this.maxX = this.x + this.width + r_margin;
        this.minY = this.y - t_margin;
        this.maxY = this.y + this.height + b_margin;
    }

    positionRandomly() {
        this.x = randomInt(Math.ceil(this.width / 2), Math.floor(map_width - this.width / 2));
        this.y = randomInt(Math.ceil(this.height / 2), Math.floor(map_height - this.height / 2));
        this.constrainToMap();
    }

    doesOverlap(other) {
        this.calculateAABB();
        other.calculateAABB();

        let overlaps_x = (this.minX >= other.minX && this.minX < other.maxX) || (other.minX >= this.minX && other.minX < this.maxX);
        let overlaps_y = (this.minY >= other.minY && this.minY < other.maxY) || (other.minY >= this.minY && other.minY < this.maxY);
        return overlaps_x && overlaps_y;
    }

    separateFrom(other) {
        let needs_separate = this.doesOverlap(other);
        if (needs_separate) {
            let diffx = other.x + other.width / 2 - (this.x + this.width / 2);
            let diffy = other.y + other.height / 2 - (this.y + this.height / 2);

            this.x -= nonzero_sign(diffx);
            this.y -= nonzero_sign(diffy);
            other.x += nonzero_sign(diffx);
            other.y += nonzero_sign(diffy);

            this.constrainToMap();
            other.constrainToMap();
        }
        return needs_separate;
    }

    constrainToMap() {
        this.x = Math.min(map_width - this.width - this.getDoorMargin(RIGHT), Math.max(this.getDoorMargin(LEFT), this.x));
        this.y = Math.min(map_height - this.height - this.getDoorMargin(BOTTOM), Math.max(this.getDoorMargin(TOP), this.y));
    }

    draw(ctx, outline = false) {
        ctx.fillStyle = this.does_overlap ? "red" : "black";
        ctx.strokeStyle = "grey";
        ctx.lineWidth = 4;
        if (!outline) {
            ctx.fillRect(toCanvasX(this.x), toCanvasX(this.y), toCanvasY(this.width), toCanvasY(this.height));
            return;
        } else {
            ctx.strokeRect(toCanvasX(this.x), toCanvasX(this.y), toCanvasY(this.width), toCanvasY(this.height));
        }

        this.doors.forEach(([side, idx, is_optional]) => {
            let x = 0;
            let y = 0;
            let x2 = 0;
            let y2 = 0;
            if (side === TOP) {
                x = idx;
                x2 = idx + 1;
            }
            if (side === BOTTOM) {
                y = y2 = this.height;
                x = idx;
                x2 = idx + 1;
            }
            if (side === LEFT) {
                y = idx;
                y2 = idx + 1;
            }
            if (side === RIGHT) {
                x = x2 = this.width;
                y = idx;
                y2 = idx + 1;
            }

            ctx.strokeStyle = is_optional ? "#FFFF00" : "#00FF00";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(toCanvasX(this.x + x), toCanvasY(this.y + y));
            ctx.lineTo(toCanvasX(this.x + x2), toCanvasY(this.y + y2));
            ctx.stroke();
            ctx.strokeStyle = "";
        });
    }
}

let failCase = JSON.parse(
    '[{"x":27,"y":5,"width":8,"height":1,"doors":[[1,6,false],[1,2,true],[2,2,false],[2,6,false],[4,0,true],[8,0,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":27,"maxX":35,"minY":4,"maxY":7},{"x":26,"y":9,"width":7,"height":7,"doors":[[1,4,true],[1,0,true],[2,1,false],[2,5,true],[4,3,true],[4,4,false],[8,2,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":26,"maxX":34,"minY":9,"maxY":17},{"x":2,"y":11,"width":4,"height":5,"doors":[[1,2,true],[1,1,true],[2,2,true],[2,0,false],[4,3,true],[4,1,true],[8,3,false],[8,4,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":1,"maxX":6,"minY":11,"maxY":17},{"x":11,"y":6,"width":2,"height":5,"doors":[[1,0,false],[2,0,false],[2,1,false],[4,2,false],[8,3,false],[8,0,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":10,"maxX":14,"minY":5,"maxY":12},{"x":8,"y":30,"width":6,"height":6,"doors":[[1,2,false],[1,4,false],[2,2,true],[2,4,false],[4,5,false],[4,0,true],[8,0,false],[8,3,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":7,"maxX":15,"minY":29,"maxY":37},{"x":38,"y":14,"width":5,"height":3,"doors":[[1,1,false],[1,2,true],[2,3,false],[2,4,false],[4,2,false],[8,0,true],[8,2,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":38,"maxX":44,"minY":13,"maxY":18},{"x":2,"y":36,"width":4,"height":1,"doors":[[1,3,false],[1,0,false],[2,2,false],[2,0,false],[4,0,true],[8,0,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":1,"maxX":6,"minY":35,"maxY":38},{"x":24,"y":7,"width":1,"height":4,"doors":[[1,0,true],[2,0,true],[4,1,true],[4,0,false],[8,2,false],[8,0,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":23,"maxX":26,"minY":7,"maxY":11},{"x":31,"y":1,"width":5,"height":2,"doors":[[1,3,false],[2,1,true],[2,4,true],[4,1,false],[8,0,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":31,"maxX":37,"minY":0,"maxY":3},{"x":6,"y":41,"width":8,"height":2,"doors":[[1,4,false],[1,6,true],[2,0,true],[2,1,true],[4,1,false],[4,0,false],[8,1,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":6,"maxX":15,"minY":40,"maxY":43},{"x":5,"y":1,"width":7,"height":3,"doors":[[1,3,true],[2,2,false],[2,0,true],[4,1,false],[4,2,false],[8,0,true],[8,2,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":4,"maxX":13,"minY":1,"maxY":5},{"x":3,"y":42,"width":2,"height":7,"doors":[[1,1,false],[2,1,true],[2,0,false],[4,1,true],[4,5,false],[8,1,true],[8,4,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":2,"maxX":6,"minY":41,"maxY":50},{"x":4,"y":17,"width":7,"height":5,"doors":[[1,4,true],[1,0,true],[2,5,false],[2,4,true],[4,3,true],[4,4,true],[8,3,false],[8,2,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":3,"maxX":11,"minY":17,"maxY":23},{"x":1,"y":40,"width":1,"height":1,"doors":[[1,0,false],[2,0,true],[4,0,false],[8,0,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":0,"maxX":3,"minY":39,"maxY":41},{"x":34,"y":7,"width":3,"height":7,"doors":[[1,0,true],[2,0,true],[2,1,true],[4,6,false],[4,2,true],[8,1,true],[8,0,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":34,"maxX":38,"minY":7,"maxY":14},{"x":43,"y":38,"width":1,"height":2,"doors":[[1,0,false],[2,0,false],[4,1,false],[4,0,true],[8,0,false],[8,1,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":42,"maxX":45,"minY":37,"maxY":41},{"x":15,"y":13,"width":8,"height":5,"doors":[[1,1,true],[2,0,false],[2,2,true],[4,0,true],[8,3,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":15,"maxX":23,"minY":13,"maxY":19},{"x":21,"y":41,"width":6,"height":8,"doors":[[1,3,false],[2,3,false],[2,5,false],[4,4,true],[4,6,false],[8,2,true],[8,3,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":21,"maxX":28,"minY":40,"maxY":50},{"x":28,"y":46,"width":6,"height":3,"doors":[[1,5,true],[1,0,true],[2,2,false],[2,0,true],[4,0,false],[4,2,false],[8,2,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":28,"maxX":35,"minY":46,"maxY":50},{"x":49,"y":38,"width":1,"height":7,"doors":[[1,0,true],[2,0,true],[4,2,true],[4,5,true],[8,1,true],[8,4,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":49,"maxX":50,"minY":38,"maxY":45},{"x":19,"y":2,"width":1,"height":5,"doors":[[1,0,false],[2,0,true],[4,2,false],[4,3,false],[8,1,false],[8,2,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":18,"maxX":21,"minY":1,"maxY":7},{"x":25,"y":17,"width":6,"height":4,"doors":[[1,0,true],[1,1,true],[2,1,false],[4,0,false],[4,1,true],[8,0,true],[8,1,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":25,"maxX":32,"minY":17,"maxY":22},{"x":42,"y":19,"width":8,"height":7,"doors":[[1,7,true],[1,2,false],[2,6,false],[2,4,false],[4,1,true],[4,3,true],[8,0,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":41,"maxX":50,"minY":18,"maxY":27},{"x":45,"y":30,"width":4,"height":5,"doors":[[1,0,false],[1,3,false],[2,3,false],[2,2,false],[4,2,false],[4,1,true],[8,2,false],[8,4,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":44,"maxX":50,"minY":29,"maxY":36},{"x":16,"y":37,"width":5,"height":3,"doors":[[1,0,false],[2,1,false],[2,0,false],[4,0,true],[8,2,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":15,"maxX":21,"minY":36,"maxY":41},{"x":37,"y":29,"width":5,"height":7,"doors":[[1,2,true],[1,3,false],[2,1,false],[2,2,true],[4,3,true],[4,6,true],[8,2,true],[8,6,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":37,"maxX":42,"minY":28,"maxY":37},{"x":33,"y":18,"width":3,"height":3,"doors":[[1,1,false],[2,1,false],[2,0,true],[4,2,true],[4,1,false],[8,2,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":32,"maxX":37,"minY":17,"maxY":22},{"x":41,"y":4,"width":8,"height":6,"doors":[[1,3,true],[2,3,true],[2,4,true],[4,1,false],[4,0,false],[8,4,false],[8,0,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":40,"maxX":50,"minY":4,"maxY":10},{"x":15,"y":27,"width":5,"height":4,"doors":[[1,1,true],[1,4,true],[2,0,true],[2,2,true],[4,0,false],[4,3,false],[8,3,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":15,"maxX":21,"minY":27,"maxY":31},{"x":12,"y":16,"width":1,"height":1,"doors":[[1,0,true],[2,0,true],[4,0,true],[8,0,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":11,"maxX":13,"minY":16,"maxY":17},{"x":37,"y":40,"width":4,"height":5,"doors":[[1,0,true],[1,1,true],[2,3,true],[4,4,false],[4,1,true],[8,3,true],[8,4,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":36,"maxX":42,"minY":40,"maxY":45},{"x":32,"y":25,"width":8,"height":2,"doors":[[1,4,true],[1,7,false],[2,2,false],[2,5,true],[4,1,false],[4,0,true],[8,0,false],[8,1,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":31,"maxX":41,"minY":24,"maxY":28},{"x":12,"y":19,"width":2,"height":5,"doors":[[1,0,false],[2,1,true],[4,4,false],[4,1,true],[8,1,true],[8,3,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":11,"maxX":15,"minY":18,"maxY":24},{"x":39,"y":20,"width":1,"height":2,"doors":[[1,0,false],[2,0,true],[4,0,false],[8,1,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":39,"maxX":41,"minY":19,"maxY":22},{"x":37,"y":48,"width":4,"height":1,"doors":[[1,3,true],[2,2,false],[2,0,true],[4,0,true],[8,0,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":37,"maxX":41,"minY":48,"maxY":50},{"x":29,"y":37,"width":6,"height":6,"doors":[[1,4,false],[1,3,true],[2,5,false],[2,1,false],[4,4,false],[4,1,false],[8,1,false],[8,5,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":28,"maxX":36,"minY":36,"maxY":44},{"x":22,"y":27,"width":8,"height":8,"doors":[[1,0,true],[1,3,false],[2,4,false],[2,5,false],[4,7,false],[4,2,true],[8,7,true],[8,1,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":22,"maxX":31,"minY":26,"maxY":36},{"x":42,"y":45,"width":7,"height":5,"doors":[[1,5,true],[1,4,true],[2,0,true],[2,6,true],[4,4,false],[4,2,false],[8,3,false],[8,2,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":41,"maxX":50,"minY":45,"maxY":50},{"x":0,"y":25,"width":8,"height":2,"doors":[[1,2,true],[1,1,true],[2,3,false],[2,0,true],[4,1,false],[8,1,true],[8,0,true]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":0,"maxX":9,"minY":25,"maxY":28},{"x":16,"y":23,"width":7,"height":3,"doors":[[1,3,false],[1,1,true],[2,5,true],[4,2,true],[4,1,true],[8,0,false],[8,2,false]],"does_overlap":false,"separateCount":0,"doorMargin":1,"minX":15,"maxX":23,"minY":22,"maxY":26}]'
);

document.addEventListener("DOMContentLoaded", (event) => {
    failCase.forEach((box) => {
        // flip on x axis
        box.x = map_width - box.width - box.x;
    });
    //const boxes = [];
    const numBoxes = 40; // Number of boxes
    let doneSeparating = false;
    let separateIterations = 0;
    let maxSeparateIterations = 200;
    let doneConnectingDoors = false;
    let failedConnectingDoors = false;
    let doneFloodFill = false;

    // Create boxes
    for (let i = 0; i < numBoxes; i++) {
        let w = randomInt(1, 8);
        let h = randomInt(1, 8);
        let x = canvas.width / 2 - w / 2;
        let y = canvas.height / 2 - h;
        let box = new Box(x, y, w, h);
        box.setRandomDoors();
        box.positionRandomly();
        //Object.entries(failCase[i]).forEach(([k, v]) => (box[k] = v));
        boxes.push(box);
    }

    function separateBoxes() {
        let anyOverlap = false;
        boxes.forEach((box) => (box.does_overlap = false));
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                let box_a = boxes[i];
                let box_b = boxes[j];

                let do_overlap = box_a.separateFrom(box_b);

                box_a.does_overlap = box_a.does_overlap || do_overlap;
                box_b.does_overlap = box_b.does_overlap || do_overlap;

                anyOverlap = do_overlap || anyOverlap;
            }
        }
        return anyOverlap;
    }

    function connectDoors(x1, y1, x2, y2) {
        let queue = [];
        let visited = new Set();
        let parent = new Map();

        // Initialize with the starting point
        queue.push([x1, y1]);
        visited.add(`${x1},${y1}`);
        parent.set(`${x1},${y1}`, null);

        // Helper function to add a new point to the queue
        function enqueue(x, y, px, py) {
            if (!isInBounds(x, y) || isInBox(x, y) || visited.has(`${x},${y}`)) return;
            queue.push([x, y]);
            visited.add(`${x},${y}`);
            parent.set(`${x},${y}`, [px, py]);
        }

        // BFS loop
        while (queue.length > 0) {
            let [cx, cy] = queue.shift();

            // Check if we've reached the destination
            if (cx === x2 && cy === y2) {
                let path = [];
                let curr = [cx, cy];
                while (curr) {
                    path.unshift(curr);
                    curr = parent.get(`${curr[0]},${curr[1]}`);
                }
                return path;
            }

            // Explore neighboring cells
            enqueue(cx + 1, cy, cx, cy); // Right
            enqueue(cx - 1, cy, cx, cy); // Left
            enqueue(cx, cy + 1, cx, cy); // Down
            enqueue(cx, cy - 1, cx, cy); // Up
        }

        // Return an empty array if no path is found
        return [];
    }

    function isInBox(x, y) {
        // Return true if the point [x, y] is inside any of the boxes
        return boxes.some((box) => x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height);
    }

    function isInBounds(x, y) {
        // Check if the point [x, y] is within the map boundaries
        return x >= 0 && x < map_width && y >= 0 && y < map_height;
    }

    function isInCorridor(x, y) {
        return corridors.find(([xx, yy]) => xx === x && yy === y);
    }

    function getBoxDoorLocations(box) {
        let doorLocations = [];
        box.doors.forEach((door) => {
            const [dir, idx, is_optional] = door;
            let x = box.x;
            let y = box.y;
            if (dir === TOP) {
                x += idx;
            }
            if (dir === BOTTOM) {
                x += idx;
                y += box.height - 1;
            }
            if (dir === LEFT) {
                y += idx;
            }
            if (dir === RIGHT) {
                y += idx;
                x += box.width - 1;
            }
            let doorExitPosX = x + (dir === LEFT ? -1 : dir === RIGHT ? 1 : 0);
            let doorExitPosY = y + (dir === TOP ? -1 : dir === BOTTOM ? 1 : 0);
            doorLocations.push([x, y, doorExitPosX, doorExitPosY, is_optional]);
        });
        return doorLocations;
    }

    function connectADoor(box) {
        let doorLocations = getBoxDoorLocations(box);
        let still_needs_connected = 0;
        let total_connected = 0;
        let doorsLeftToConnect = doorLocations.filter(([x, y, exitX, exitY, is_optional]) => {
            let inCorridor = corridors.find(([cx, cy]) => cx === exitX && cy === exitY);
            let inOtherBox = boxes.find((otherBox) => {
                return (
                    otherBox !== box &&
                    exitX >= otherBox.x &&
                    exitX < otherBox.x + otherBox.width &&
                    exitY >= otherBox.y &&
                    exitY < otherBox.y + otherBox.height
                );
            });
            let connected = inOtherBox || inCorridor;
            if (!connected && !is_optional) {
                still_needs_connected++;
            }

            if (connected) total_connected++;

            return !connected && isInBounds(exitX, exitY);
        });

        if (doorsLeftToConnect.length === 0) return false;

        // Prefer non optional doors
        if (doorsLeftToConnect.some(([x, y, exitX, exitY, is_optional]) => !is_optional))
            doorsLeftToConnect = doorsLeftToConnect.filter(([x, y, exitX, exitY, is_optional]) => !is_optional);

        // If we're already connected to another room, and all our mandatory doors are connected, no need to connect more.
        if (total_connected >= 1 && still_needs_connected === 0) return false;

        const [inX, inY, fromX, fromY] = doorsLeftToConnect[0];
        console.log("connecting");

        let otherBoxDoors = boxes
            .filter((otherBox) => otherBox !== box)
            .map(getBoxDoorLocations)
            .flat()
            .map(([x, y, exitX, exitY]) => [exitX, exitY])
            .filter(([x, y]) => isInBounds(x, y) && !isInBox(x, y));
        let possibleConnectLocations = corridors.slice().concat(otherBoxDoors);
        let closest = possibleConnectLocations[0];

        let closestDist = Math.pow(closest[0] - fromX, 2) + Math.pow(closest[1] - fromY, 2);
        possibleConnectLocations.forEach(([x, y]) => {
            let dist = Math.pow(x - fromX, 2) + Math.pow(y - fromY, 2);
            if (dist < closestDist) {
                closest = [x, y];
                closestDist = dist;
            }
        });

        let path = connectDoors(fromX, fromY, closest[0], closest[1]);
        if (path.length) {
            corridors.push(...path);
            return true;
        } else {
            failPoints.push([fromX, fromY], [closest[0], closest[1]]);
            //failPoints.push([fromX, fromY]);
            //failPoints.push(...possibleConnectLocations.filter((c) => !isInCorridor(...c)));
            throw Error();
        }
    }

    function expandFloodFill() {
        function fillPoint(x, y, fromBox) {
            if (x < 0 || y < 0 || x >= map_width || y >= map_height) return;
            if (floodFill.find(([xx, yy]) => xx === x && yy === y)) return;

            let toBox = boxes.find((box) => {
                return x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
            });
            if (fromBox) {
                if (toBox === fromBox) {
                    floodFill.push([x, y]);
                    return;
                }
                let fromBoxDoors = getBoxDoorLocations(fromBox).map(([x, y, exitX, exitY]) => [exitX, exitY]);
                if (!fromBoxDoors.find(([exitX, exitY]) => x === exitX && y === exitY)) return; // Only fill to locations reachable by doors
            }

            // If it's a corridor, floodfill
            if (corridors.find(([xx, yy]) => x === xx && y === yy)) {
                floodFill.push([x, y]);
                return;
            }

            let toBoxDoors = !toBox ? [] : getBoxDoorLocations(toBox).map(([x, y, exitX, exitY]) => [x, y]);
            if (toBoxDoors.find(([xx, yy]) => x === xx && y === yy)) {
                floodFill.push([x, y]);
            }
        }
        floodFill.forEach(([x, y]) => {
            let curBox = boxes.find((box) => {
                return x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
            });
            fillPoint(x + 1, y + 0, curBox);
            fillPoint(x - 1, y + 0, curBox);
            fillPoint(x + 0, y + 1, curBox);
            fillPoint(x + 0, y - 1, curBox);
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid(0, 0, Math.floor(canvas.width / map_width));
        if (!doneSeparating && separateIterations < maxSeparateIterations) {
            doneSeparating = !separateBoxes();
            console.log("Separate iteration: ", ++separateIterations);
        }

        if (doneSeparating && !doneConnectingDoors) {
            try {
                let doorWasConnected = false;
                for (let i = 0; i < boxes.length && !doneConnectingDoors; i++) {
                    let result = connectADoor(boxes[i]);
                    doorWasConnected = result || doorWasConnected;
                    if (result) break;
                }
                if (!doorWasConnected) doneConnectingDoors = true;
            } catch (err) {
                //console.log("Failed connecting doors. Error:")
                //console.error(err)
                doneConnectingDoors = true;
                failedConnectingDoors = true;
            }
        }

        //room fill
        for (let box of boxes) {
            box.draw(ctx, false);
        }

        corridors.forEach(([x, y]) => {
            ctx.fillStyle = "#333";
            ctx.fillRect(toCanvasX(x), toCanvasY(y), toCanvasX(1), toCanvasY(1));
        });

        // flood fill check at end
        for (let [x, y] of floodFill) {
            ctx.fillStyle = "rgba(0.0,0.0,255,0.5)";
            //ctx.fillStyle = "blue";
            ctx.fillRect(toCanvasX(x), toCanvasY(y), toCanvasX(1), toCanvasY(1));
        }

        //room outline
        for (let box of boxes) {
            box.draw(ctx, true);
        }

        if (doneConnectingDoors && !failedConnectingDoors && !doneFloodFill) {
            if (floodFill.length === 0) {
                floodFill.push([boxes[0].x, boxes[0].y]);
            }
            let len = floodFill.length;
            expandFloodFill();
            let postExpandLen = floodFill.length;

            if (postExpandLen === len) {
                doneFloodFill = true;
                let allRoomsFilled = boxes.every((box) => !!floodFill.find(([xx, yy]) => box.x === xx && box.y === yy));
                if (!allRoomsFilled) {
                    document.querySelector("#info").innerText = "Failed safety check for all rooms being reachable, we will use a union find algorithm to avoid this case or restart here in real implementation";
                } else {
                    document.querySelector("#info").innerText = "Finished generating, all rooms are reachable";
                }
            }
        }

        failPoints.forEach(([x, y], i) => {
            ctx.fillStyle = i === 0 ? "#FF0000" : "#FF00FF";
            if (i > 1) ctx.fillStyle = " purple";
            ctx.fillRect(toCanvasX(x), toCanvasY(y), toCanvasX(1), toCanvasY(1));
        });

        if (separateIterations >= maxSeparateIterations && !doneSeparating) {
            document.querySelector("#info").innerText = "Failed separation phase, would restart here in real implementation";
            return;
        }
        if (failedConnectingDoors) {
            document.querySelector("#info").innerText = "Failed connecting doors phase, would restart here in real implementation";
            return;
        }
        requestAnimationFrame(animate);
    }

    animate();
});

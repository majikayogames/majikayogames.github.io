let generateSeed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript/47593316#47593316
function seededRandom(seed) {
    let a = seed !== undefined ? seed : generateSeed++;
    a |= 0; a = a + 0x9e3779b9 | 0;
    var t = a ^ a >>> 16; t = Math.imul(t, 0x21f0aaad);
        t = t ^ t >>> 15; t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
}

function randInt(min, max) {
    return Math.floor(min + seededRandom() * (max+1 - min))
}

class AABB {
    constructor(minX, minY, minZ, maxX, maxY, maxZ) {
        this.minX = minX;
        this.minY = minY;
        this.minZ = minZ;
        this.maxX = maxX;
        this.maxY = maxY;
        this.maxZ = maxZ;
    }

    // Method to check if another AABB intersects with this one
    intersects(other) {
        return this.minX < other.maxX && this.maxX >= other.minX &&
               this.minY < other.maxY && this.maxY >= other.minY &&
               this.minZ < other.maxZ && this.maxZ >= other.minZ;
    }

    contains(x,y,z) {
        return x >= this.minX && y >= this.minY && z >= this.minZ &&
               x < this.maxX && y < this.maxY && z < this.maxZ
    }
}

class TreeGraph {
    constructor(nodes) {
        this.nodes = nodes
        // Initially, each node is its own root.
        this.roots = nodes.reduce((roots, node) => ({ ...roots, [node]: node }), {});
    }

    findRoot(node) {
        // Path Compression: makes the tree 'flatter' for efficient future accesses
        if (this.roots[node] !== node) {
            this.roots[node] = this.findRoot(this.roots[node]);
        }
        return this.roots[node];
    }

    connect(nodeA, nodeB) {
        let rootA = this.findRoot(nodeA);
        let rootB = this.findRoot(nodeB);

        // If roots are different, merge the trees. Note: Must choose the lower indexed node so they coagulate properly towards a single root.
        // Had this bug in it for a while and never ran into the edge case until port to Godot.
        // But it's possible the generator can get stuck in an infinite loop with this, swapping the same 2 roots, stealing the connection back each time.
        if (rootA !== rootB) {
            if(this.nodes.indexOf(nodeA) < this.nodes.indexOf(nodeB))
                this.roots[rootB] = rootA;
            else
                this.roots[rootA] = rootB;
        }
    }

    isConnected(nodeA, nodeB) {
        return this.findRoot(nodeA) === this.findRoot(nodeB)
    }

    isFullyConnected() {
        return this.nodes.every(r => this.findRoot(r) === this.findRoot(this.nodes[0]))
    }
}

function _aStar(start, goal, neighbors, cost, heuristic) {
    const closedSet = new Set(), openSet = new Set([start]);
    const cameFrom = new Map(), gScore = new Map([[start, 0]]);
    const fScore = new Map([[start, heuristic(start, goal)]]);

    function reconstructPath(c) {
        let path = [c];
        while (cameFrom.has(c)) path.unshift(c = cameFrom.get(c));
        return path;
    }

    while (openSet.size) {
        let current = [...openSet].reduce((a, b) => fScore.get(a) < fScore.get(b) ? a : b);
        // Check equality via stringify since we're passing [x,y] arrays
        if (current === goal) return reconstructPath(current);

        openSet.delete(current), closedSet.add(current);
        for (let neighbor of neighbors(current)) {
            if (closedSet.has(neighbor)) continue;
            let tentativeGScore = gScore.get(current) + cost(current, neighbor);

            if (!openSet.has(neighbor)) openSet.add(neighbor);
            else if (tentativeGScore >= gScore.get(neighbor)) continue;

            cameFrom.set(neighbor, current);
            gScore.set(neighbor, tentativeGScore);
            fScore.set(neighbor, tentativeGScore + heuristic(neighbor, goal));
        }
    }
    return null; // path not found
}

// Shim to use [x,y,z] coords since js has no vector class i can use for this easily
function aStar(start, goal, neighbors, cost = () => 10, heuristic = (a,b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) {
    let fromStr = (str) => str.split(",").map(n => parseInt(n))
    let toStr = (arr) => arr.join(",")
    let result = _aStar(toStr(start), toStr(goal), (cell) => neighbors(fromStr(cell)).map(n => toStr(n)), (current, neighbor) => cost(fromStr(current), fromStr(neighbor)), (start, goal) => heuristic(fromStr(start), fromStr(goal)))
    return result ? result.map(fromStr) : null
}

// Bit flags for the six directions
const FRONT = 0b000001;
const BACK = 0b000010;
const RIGHT = 0b000100;
const LEFT = 0b001000;
const TOP = 0b010000;
const BOTTOM = 0b100000;
const ALL_DIRS = FRONT | BACK | RIGHT | LEFT | TOP | BOTTOM;
const XZ_DIRS = FRONT | BACK | RIGHT | LEFT;
const Y_DIRS = TOP | BOTTOM;
const NO_DIR = 0;
const NEGATE_DIRECTION = {
    FRONT: BACK,
    BACK: FRONT,
    LEFT: RIGHT,
    RIGHT: LEFT,
    TOP: BOTTOM,
    BOTTOM: TOP
}

// Generation stages
const PLACE_ROOMS = 0;
const PLACE_STAIRS = 1;
const SEPARATE_ROOMS = 2;
const CONNECT_ROOMS = 3;
const DONE = 4;
let stage = PLACE_STAIRS;

MAX_SEPARATE_ITERATION_COUNT = 500;
let separateIterationCount = 0;

let dungeon = []
let dungeon_size_x = 10
let dungeon_size_y = 10
let dungeon_size_z = 10

let stairGraph = null
let floorGraphs = null
let roomsOnEachFloor = null

let rooms = {
    EntranceRoom: {
        size_x: 1,
        size_y: 1,
        size_z: 1,
        doors: [[0,0,0,LEFT],[0,0,0,FRONT],[0,0,0,RIGHT]],
        minCount: 1,
        maxCount: 1,
        isEntrance: true
    },
    "Living room": {
        size_x: 3,
        size_y: 1,
        size_z: 2,
        doors: [[0,0,0,LEFT],[0,0,1,LEFT],[1,0,0,BACK],[2,0,0,RIGHT],[2,0,1,RIGHT]],
        minCount: 3,
        maxCount: 5
    },
    Hallway: {
        size_x: 1,
        size_y: 1,
        size_z: 2,
        doors: [[0,0,0,BACK],[0,0,1,FRONT]],
        minCount: 3,
        maxCount: 5
    },
    "Corridor": {
        size_x: 1,
        size_y: 1,
        size_z: 1,
        doors: [[0,0,0,FRONT,true],[0,0,0,RIGHT,true],[0,0,0,BACK,true],[0,0,0,LEFT,true]],
        minCount: 0,
        maxCount: 0,
        isCorridor: true
    },
    "Ladder": {
        size_x: 1,
        size_y: 2,
        size_z: 1,
        doors: [[0,0,0,FRONT],[0,0,0,BACK],[0,1,0,LEFT],[0,1,0,RIGHT]],
        isStairs: true,
        minCount: 1,
        maxCount: 5,
    },
    "Stairs": {
        size_x: 2,
        size_y: 2,
        size_z: 1,
        doors: [[0,0,0,LEFT],[1,1,0,RIGHT]],
        isStairs: true,
        minCount: 1,
        maxCount: 25,
    },
    "BigStairRoom": {
        size_x: 3,
        size_y: 2,
        size_z: 3,
        doors: [[1,0,0,BACK],[0,0,2,FRONT, true],[2,0,2,FRONT, true],[1,1,2,FRONT, false]],
        isStairs: true,
        minCount: 1,
        maxCount: 1,
    }
};

function getRoomAt(x,y,z,needsDoorAtPos=false,doorMustBeFacingDirections=ALL_DIRS) {
    let hit_rooms = dungeon.filter(([rx,ry,rz,room]) => {
        if(x < rx || y < ry || z < rz) return false
        if(x >= rx + room.size_x) return false
        if(y >= ry + room.size_y) return false
        if(z >= rz + room.size_z) return false

        if(needsDoorAtPos !== null) {
            return room.doors.some(([dx,dy,dz,dir]) => {
                if(dx == rx && dy == ry && dz == rz && (dir & doorMustBeFacingDirections)) return true
            })
        }
        return true
    })
    return hit_rooms.length ? hit_rooms[0] : null
}

function getRoomsList() {
    return Object.keys(rooms);
}

// Metadata to store generated meshes and some visual stuff like whether they overlap
function addDungeonRoomInfo(dungeonRoom, info={}) {
    let [x,y,z,room,curInfo] = dungeonRoom
    if(!curInfo) {
        dungeonRoom.push(info)
        return info
    }
    else {
        Object.assign(curInfo, info)
        return curInfo
    }
}

function getRoomAABB(dungeonRoom, expandToDoors=false) {
    const [x,y,z,room] = dungeonRoom;
    let aabb = new AABB(x,y,z,x+room.size_x,y+room.size_y,z+room.size_z);
    if(expandToDoors) {
        if(room.doors.some(([x,y,z,dir,optional]) => dir === LEFT && !optional)) aabb.minX -= 1
        if(room.doors.some(([x,y,z,dir,optional]) => dir === RIGHT && !optional)) aabb.maxX += 1
        if(room.doors.some(([x,y,z,dir,optional]) => dir === FRONT && !optional)) aabb.maxZ += 1
        if(room.doors.some(([x,y,z,dir,optional]) => dir === BACK && !optional)) aabb.minZ -= 1
    }
    return aabb;
}

function getDungeonAABB() {
    return new AABB(0,0,0,dungeon_size_x,dungeon_size_y,dungeon_size_z)
}

function roomsOverlap(dungeonRoomA, dungeonRoomB) {
    const [ax,ay,az,roomA] = dungeonRoomA
    const [bx,by,bz,roomB] = dungeonRoomB
    //aabb overlap
    let roomA_AABB = getRoomAABB(dungeonRoomA)
    let roomB_AABB = getRoomAABB(dungeonRoomB)
    let aabb_overlap = roomA_AABB.intersects(roomB_AABB);
    // This is actually broken right now... Should fix before video. Realized when porting to Godot
    // Also needs to check for door overlap.
    return aabb_overlap
}

function separateRooms(dungeonRoomA, dungeonRoomB) {
    if (roomsOverlap(dungeonRoomA, dungeonRoomB)) {
        const [ax,ay,az,roomA] = dungeonRoomA
        const [bx,by,bz,roomB] = dungeonRoomB
        let diffx = bx + roomB.size_x / 2 - (ax + roomA.size_x / 2);
        let diffy = by + roomB.size_y / 2 - (ay + roomA.size_y / 2);
        let diffz = bz + roomB.size_z / 2 - (az + roomA.size_z / 2);

        dungeonRoomA[0] -= diffx > 0 ? 1 : -1
        //if(!roomA.isStairs) dungeonRoomA[1] -= diffy > 0 ? 1 : -1
        dungeonRoomA[2] -= diffz > 0 ? 1 : -1
        dungeonRoomB[0] += diffx > 0 ? 1 : -1
        //if(!roomB.isStairs) dungeonRoomB[1] += diffy > 0 ? 1 : -1
        dungeonRoomB[2] += diffz > 0 ? 1 : -1

        constrainToBounds(dungeonRoomA);
        constrainToBounds(dungeonRoomB);
    }
}

function constrainToBounds(dungeonRoom) {
    const [x,y,z,room] = dungeonRoom
    let aabbWithDoors = getRoomAABB(dungeonRoom, true)
    if(aabbWithDoors.minX < 0) dungeonRoom[0] += -aabbWithDoors.minX
    if(aabbWithDoors.minY < 0) dungeonRoom[1] += -aabbWithDoors.minY
    if(aabbWithDoors.minZ < 0) dungeonRoom[2] += -aabbWithDoors.minZ
    if(aabbWithDoors.maxX > dungeon_size_x) dungeonRoom[0] -= aabbWithDoors.maxX - dungeon_size_x
    if(aabbWithDoors.maxY > dungeon_size_y) dungeonRoom[1] -= aabbWithDoors.maxY - dungeon_size_y
    if(aabbWithDoors.maxZ > dungeon_size_z) dungeonRoom[2] -= aabbWithDoors.maxZ - dungeon_size_z
}

function updateDungeonGen() {
    if(stage === PLACE_ROOMS) {
        // Place rooms randomly until all room types have been placed
        var rooms_to_place = Object.values(rooms).filter((room) => {
            let count = dungeon.filter(([x,y,z,room2]) => room === room2).length
            // Take this room out of the list if there's already enough placed
            return count < room.maxCount
        })
        if(rooms_to_place.length > 0) {
            var rand_room = rooms_to_place[Math.floor(randInt(0, rooms_to_place.length - 1))]
            // push it to same random location on the map, within bounds
            dungeon.push([
                randInt(0, dungeon_size_x - rand_room.size_x),
                randInt(0, dungeon_size_y - rand_room.size_y),
                randInt(0, dungeon_size_z - rand_room.size_z),
                rand_room
            ])
            constrainToBounds(dungeon[dungeon.length - 1])
        }

        var rooms_still_needed_count = Object.values(rooms).filter((room) => {
            let count = dungeon.filter(([x,y,z,room2]) => room === room2).length
            // Take this room out of the list if there's already enough placed
            return count < room.minCount
        }).length
        if (rooms_still_needed_count === 0) {
            stage++
            console.log("Done rooms placement stage.")
        };
    }
    else if(stage === PLACE_STAIRS) {
        if(stairGraph === null) {
            // Create an array to represent all the floors that need to be connected by stairs. Initially, we say each level must be connected to each other level.
            stairGraph = new TreeGraph([...Array(dungeon_size_y).keys()])
            // Build the initial tree, there may already be some stairs placed so connect the graph on those floors.
            dungeon.forEach(([x,y,z,room]) => room.doors.forEach(([dx,dy,dz], i) => stairGraph.connect(y+dy, y+room.doors[0][1])))
        }

        let connectedAStair = false;
        var stairs_to_place = Object.values(rooms).filter((room) => {
            let count = dungeon.filter(([x,y,z,room2]) => room === room2).length
            // Take this room out of the list if there's already enough placed
            // A room is considered a 'stair' if it has doors on more than one level
            return [...new Set(room.doors.map(([dx,dy,dz]) => dy))].length > 0 && count < room.maxCount
        })
        // Try each stair type available and check if it lets us move to any new floors
        while(connectedAStair === false && stairs_to_place.length > 0 && !stairGraph.isFullyConnected()) {
            let stairRoom = stairs_to_place.splice(randInt(0, stairs_to_place.length - 1), 1)[0]
            for(let y = 0; y <= dungeon_size_y - stairRoom.size_y; y++) {
                let exitFloors = [...new Set(stairRoom.doors.map(([x,yy,z]) => yy + y))]
                // If this stair connects two previously unconnected floors, place it in the level
                if(exitFloors.some(startFloor => exitFloors.some((endFloor) => !stairGraph.isConnected(startFloor, endFloor)))) {
                    // place stair and recursively update stair graph to remove the newly connected floors
                    dungeon.push([
                        randInt(0, dungeon_size_x - stairRoom.size_x),
                        y,
                        randInt(0, dungeon_size_z - stairRoom.size_z),
                        stairRoom
                    ])
                    constrainToBounds(dungeon[dungeon.length - 1])
                    // Connect each floor the stair connects to to each other floor on the stair graph.
                    exitFloors.forEach(floor => {
                        exitFloors.forEach(connectedFloor => {
                            if(floor !== connectedFloor) stairGraph.connect(floor, connectedFloor)
                        })
                    })
                    connectedAStair = true;
                    break;
                }
            }
        }
        if(stairGraph.isFullyConnected()) {
            console.log("Done stairs placement stage.")
            stage++;
            //stage = DONE;
        }
        else if(!connectedAStair) {
            stage = DONE;
            alert("Failed stairs placement stage, found impossible to complete graph.")
        }
    }
    else if(stage === SEPARATE_ROOMS) {
        let anyOverlap = false;
        dungeon.forEach(room => addDungeonRoomInfo(room, {overlapping: false}))
        for(let i = 0; i < dungeon.length; i++) {
            for(let j = i + 1; j < dungeon.length; j++) {
                if(roomsOverlap(dungeon[i], dungeon[j])) {
                    addDungeonRoomInfo(dungeon[i], {overlapping: true})
                    addDungeonRoomInfo(dungeon[j], {overlapping: true})
                    anyOverlap = true
                    separateRooms(dungeon[i], dungeon[j])
                }
            }
        }
        separateIterationCount++

        if(!anyOverlap) {
            stage++;
            console.log("Done separation stage.")
        }
        else if(separateIterationCount >= MAX_SEPARATE_ITERATION_COUNT) {
            stage = DONE;
            alert("Failed separation stage.")
        }
    }
    else if(stage === CONNECT_ROOMS) {
        if(floorGraphs === null) {
            // Loop through the floors, and check which of the rooms have a door which leads to that floor
            roomsOnEachFloor = [...Array(dungeon_size_y)].map((_,floor) => dungeon.filter(([x,y,z,room]) => room.doors.some(([xx,yy,zz]) => y + yy === floor)))
            floorGraphs = roomsOnEachFloor.map((roomsOnFloor) => new TreeGraph(roomsOnFloor))
        }

        let addedCorridor = false;
        for(let floorNum = 0; floorNum < roomsOnEachFloor.length; floorNum++) {
            const curFloor = roomsOnEachFloor[floorNum]
            const floorGraph = floorGraphs[floorNum]
            // Get list of doors on this floor
            let doorsOnThisFloor = curFloor.flatMap(([x,y,z,room], i) => room.doors.map(([xx,yy,zz,dir,optional]) => [
                xx + x + (dir === LEFT ? -1 : dir === RIGHT ? 1 : 0),
                yy + y + (dir === BOTTOM ? -1 : dir === TOP ? 1 : 0),
                zz + z + (dir === BACK ? -1 : dir === FRONT ? 1 : 0),
                curFloor[i], // Reference to tree graph node
                optional
            ])).filter(([x,y,z,room,optional]) => y === floorNum);
            // Remove rooms which already are connected even without corridors
            doorsOnThisFloor = doorsOnThisFloor.filter(([x,y,z,dungeonRoom]) => !curFloor.some((otherDungeonRoom) => {
                let alreadyConnected = getRoomAABB(otherDungeonRoom).contains(x,y,z);
                // Mark rooms as connected on the graph
                if(alreadyConnected) floorGraph.connect(dungeonRoom, otherDungeonRoom)
                return alreadyConnected
            }))
            // Filter list for doors for ones we need to connect: - not yet connected, or part of a room which is not yet connected to root 0 in TreeGraph, then shift first door found
            // First, prefer to fully connect all rooms on the tree graph
            let doorA = doorsOnThisFloor.find(([x,y,z,room]) => !floorGraph.isConnected(curFloor[0], room))
            // If the tree graph is fully connected, then start connecting rooms which don't have a corridor in front of them yet
            if(!doorA) doorA = doorsOnThisFloor.find(([x,y,z,dungeonRoom,optional]) => !optional && !dungeon.some((otherDungeonRoom) => getRoomAABB(otherDungeonRoom).contains(x,y,z)))
            if(doorA) {
                const [ax,ay,az,roomA] = doorA;
                // Filter entire list of doors for rooms which are not yet connected to the door we're connecting's room
                // TODO: make this a filter then sort by distance maybe:
                const doorB = doorsOnThisFloor.find(([x,y,z,roomB,optional]) => roomB !== roomA && (floorGraph.isFullyConnected() || !floorGraph.isConnected(roomA, roomB)))

                // First push doorA location to pathResult. For the edge case where there is no suitable path, or this is the only door on the floor like for stairs leading to nowhere.
                let corridorsToAdd = [[ax,az]]
                if(doorB) {
                    const [bx,by,bz,roomB] = doorB;
                    corridorsToAdd.push([bx,bz])

                    const getValidMoves = ([x,z]) => {
                        // Can't move into existing rooms on our way, unless they are corridors.
                        let moves = [[x-1, z+0],[x+1,z+0],[x+0,z-1],[x+0,z+1]]
                        return moves.filter(([x,z]) => getDungeonAABB().contains(x,0,z) && !roomsOnEachFloor.flat().some((dungeonRoom) => getRoomAABB(dungeonRoom).contains(x,floorNum,z)))
                    }
                    const cost = (current, [x,z]) => {
                        if(dungeon.some(([xx,yy,zz,room]) => yy === floorNum && room.isCorridor && xx === x && zz === z)) {
                            return 0;
                        }
                        else {
                            return 10;
                        }
                    }
                    // TODO make cost to move through existing corridors 0
                    let pathResult = aStar([ax,az], [bx, bz], getValidMoves, cost, () => 0)
                    if(pathResult) {
                        corridorsToAdd.push(...pathResult, [bx,bz])
                        floorGraph.connect(roomA, roomB);
                    }
                    else {
                        console.log(roomA)
                        console.log(roomB)
                        console.log(`Couldn't find path from ${ax},${az} to ${bx},${bz}`)
                    }
                }
                else {
                    console.log("Failed to find doorB")
                }

                corridorsToAdd.forEach(([x,z]) => {
                    if(dungeon.some(([xx,yy,zz]) => floorNum === yy && x === xx && z === zz)) return // Dont place corridors twice
                    dungeon.push([
                        x,
                        floorNum,
                        z,
                        rooms["Corridor"]
                    ])
                })

                addedCorridor = true
                break
            }
        }

        // Could not find a door to connect. Either we're done connecting all doors or it failed somewhere.
        if(!addedCorridor) {
            if(floorGraphs.every(graph => graph.isFullyConnected())) {
                stage++;
                console.log("Done room connection stage")
            }
            else {
                stage = DONE;
                alert("Failed room connection stage");
            }
        }
    }
    else {
        stage = DONE;
    }

    return stage !== DONE;
}

function startGeneratingDungeon() {
    stage = PLACE_ROOMS;
    generateSeed = settings.seed;
    separateIterationCount = 0;
    dungeon = []
    stairGraph = null
    floorGraphs = null
    roomsOnEachFloor = null
    dungeon_size_x = settings.x_size;
    dungeon_size_y = settings.y_size;
    dungeon_size_z = settings.z_size;
}
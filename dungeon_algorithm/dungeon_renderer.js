function getOppositeDirection(direction) {
    if (direction === FRONT) return BACK;
    if (direction === BACK) return FRONT;

    if (direction === LEFT) return RIGHT;
    if (direction === RIGHT) return LEFT;

    if (direction === TOP) return BOTTOM;
    if (direction === BOTTOM) return TOP;

    return 0;
}

function getDirectionAsCoord(dir) {
    let xyz = [0, 0, 0];
    xyz[0] += dir & LEFT ? -1 : 0;
    xyz[0] += dir & RIGHT ? 1 : 0;
    xyz[1] += dir & BOTTOM ? -1 : 0;
    xyz[1] += dir & TOP ? 1 : 0;
    xyz[2] += dir & BACK ? -1 : 0;
    xyz[2] += dir & FRONT ? 1 : 0;
}

function splitDir(direction) {
    var dirs = [];

    if (direction & FRONT) dirs.push(FRONT);
    if (direction & BACK) dirs.push(BACK);

    if (direction & LEFT) dirs.push(LEFT);
    if (direction & RIGHT) dirs.push(RIGHT);

    if (direction & TOP) dirs.push(TOP);
    if (direction & BOTTOM) dirs.push(BOTTOM);

    return dirs;
}

// (function setRoomMetadata() {
//     Object.entries(rooms).forEach(([name, room]) => {
//         room.array3D = makeRoom3DArray(room.floorPlan)
//         room.x_size = room.array3D.length
//         room.y_size = room.array3D[0].length
//         room.z_size = room.array3D[0][0].length
//         room.doors = [] // element format [x, y, z, direction, is_optional]
//         room.floorPlan.forEach(([x,y,z,doors,optional_door_modifier]) => {
//             if(doors & LEFT) room.doors.push([x, y, z, LEFT, !!(LEFT & optional_door_modifier)])
//             if(doors & RIGHT) room.doors.push([x, y, z, RIGHT, !!(RIGHT & optional_door_modifier)])
//             if(doors & FRONT) room.doors.push([x, y, z, FRONT, !!(FRONT & optional_door_modifier)])
//             if(doors & BACK) room.doors.push([x, y, z, BACK, !!(BACK & optional_door_modifier)])
//             if(doors & TOP) room.doors.push([x, y, z, TOP, !!(TOP & optional_door_modifier)])
//             if(doors & BOTTOM) room.doors.push([x, y, z, BOTTOM, !!(BOTTOM & optional_door_modifier)])
//         })
//     })
// })()


function makeRoom3DArray(roomList, includeOptionalDoors) {
    let max = roomList[0].slice(0,3)
    roomList.forEach((pos) => {
        max = max.map((m, i) => Math.max(m, pos[i]))
    })
    let arr = make3DArray(...max.map((v, i) => v + 1), null)
    let arr_optional_doors = make3DArray(...max.map((v, i) => v + 1), NO_DIR)
    roomList.forEach(([x,y,z,door_directions=NO_DIR,optional_door_modifier=NO_DIR]) => {
        arr[x][y][z] = door_directions
        arr_optional_doors[x][y][z] = optional_door_modifier & door_directions
    })
    console.log(arr)

    loopThrough3DArray(arr, (initialVal, x, y, z) => {
        if (initialVal === null) { return }
        if (getFrom3DArray(arr, x + 1, y, z, null) !== null) arr[x][y][z] |= RIGHT
        if (getFrom3DArray(arr, x - 1, y, z, null) !== null) arr[x][y][z] |= LEFT
        if (getFrom3DArray(arr, x, y + 1, z, null) !== null) arr[x][y][z] |= TOP
        if (getFrom3DArray(arr, x, y - 1, z, null) !== null) arr[x][y][z] |= BOTTOM
        if (getFrom3DArray(arr, x, y, z + 1, null) !== null) arr[x][y][z] |= FRONT
        if (getFrom3DArray(arr, x, y, z - 1, null) !== null) arr[x][y][z] |= BACK
    })

    if(includeOptionalDoors) {
        loopThrough3DArray(arr_optional_doors, (val, x, y, z) => {
            arr_optional_doors[x][y][z] = [arr[x][y][z], val]
        })
        return arr_optional_doors
    }

    return arr
}


/**
 * Creates a 3D array of given dimensions initialized with the specified default value.
 * @param {number} x - The size in the x dimension.
 * @param {number} y - The size in the y dimension.
 * @param {number} z - The size in the z dimension.
 * @param {*} defaultValue - The default value to initialize each element with.
 * @returns {Array} - The created 3D array.
 */
function make3DArray(x, y, z, defaultValue = 0) {
    const arr = new Array(x);
    for (let i = 0; i < x; i++) {
        arr[i] = new Array(y);
        for (let j = 0; j < y; j++) {
            arr[i][j] = new Array(z).fill(defaultValue);
        }
    }
    return arr;
}

function loopThrough3DArray(array, callback) {
    for (let x = 0; x < array.length; x++) {
        for (let y = 0; y < array[x].length; y++) {
            for (let z = 0; z < array[x][y].length; z++) {
                callback(array[x][y][z], x, y, z);
            }
        }
    }
}

function getFrom3DArray(arr, x, y, z, fallbackValue) {
    if (x < 0 || x >= arr.length) return fallbackValue;
    if (y < 0 || y >= arr[0].length) return fallbackValue;
    if (z < 0 || z >= arr[0][0].length) return fallbackValue;
    return arr[x][y][z];
}

/**
 * Populates the given 3D array with random combinations of the 6 bit flags.
 * @param {Array} array - The 3D array to populate.
 */
function populateWithRandomFlags(array) {
    for (let x = 0; x < array.length; x++) {
        for (let y = 0; y < array[x].length; y++) {
            for (let z = 0; z < array[x][y].length; z++) {
                // Random combination of flags
                array[x][y][z] = Math.floor(Math.random() * 64); // 64 because 2^6 = 64 possible combinations
            }
        }
    }

    setOuterWalls(array);
}

function setOuterWalls(array) {
    const maxX = array.length - 1;
    const maxY = array[0].length - 1;
    const maxZ = array[0][0].length - 1;

    for (let x = 0; x <= maxX; x++) {
        for (let y = 0; y <= maxY; y++) {
            for (let z = 0; z <= maxZ; z++) {
                if (x === 0) array[x][y][z] |= LEFT;
                if (x === maxX) array[x][y][z] |= RIGHT;
                if (y === 0) array[x][y][z] |= BOTTOM;
                if (y === maxY) array[x][y][z] |= TOP;
                if (z === 0) array[x][y][z] |= BACK;
                if (z === maxZ) array[x][y][z] |= FRONT;
            }
        }
    }
}

function createDungeonRender(dungeonArray, voxelSize = 1, drawOutline = true, drawOptionalDoors = true) {
    const dungeon = new THREE.Group();
    const innerGroup = new THREE.Group(); // Create an inner group

    let totalX = dungeon_size_x * voxelSize;
    let totalY = dungeon_size_y * voxelSize;
    let totalZ = dungeon_size_z * voxelSize;

    // Center preview rooms
    if(dungeonArray.length === 1 && !drawOutline) {
        totalX = dungeonArray[0][3].size_x * voxelSize
        totalY = dungeonArray[0][3].size_y * voxelSize
        totalZ = dungeonArray[0][3].size_z * voxelSize
    }

    if (drawOutline) {
        const geometry = new THREE.BoxGeometry(dungeon_size_x, dungeon_size_y, dungeon_size_z);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const outlineCube = new THREE.LineSegments(edges, material);
        dungeon.add(outlineCube);
    }

    dungeonArray.forEach((dungeonRoom, room_index) => {
        let [x,y,z,room] = dungeonRoom
        let info = addDungeonRoomInfo(dungeonRoom, {})
        const {size_x, size_y, size_z, doors} = room;

        //console.log(info)

        let roomColor
        if(info.overlapping) roomColor = 0xff0000;
        //else if(room.isStairs) roomColor = 0xffffff;
        else if(room.isEntrance) roomColor = 0x7777bb;
        else roomColor = getRandomGrayColorInRange(100, 200, (room_index + 1) * 123123)

        let createMesh = false
        if(!info.voxels) {
            info.voxels = new THREE.Group();
            createMesh = true
        }
        //console.log(roomColor)
        if(info.material) {
            info.material.color = new THREE.Color( roomColor );
        }

        for(let rx = 0; rx < size_x; rx++) {
            for(let ry = 0; ry < size_y; ry++) {
                for(let rz = 0; rz < size_z; rz++) {
                    // block out room walls as cuboid with middle voxel walls unfilled
                    let voxel = ALL_DIRS;
                    if(rx - 1 >= 0) voxel ^= LEFT
                    if(ry - 1 >= 0) voxel ^= BOTTOM
                    if(rz - 1 >= 0) voxel ^= BACK
                    if(rx + 1 < size_x) voxel ^= RIGHT
                    if(ry + 1 < size_y) voxel ^= TOP
                    if(rz + 1 < size_z) voxel ^= FRONT
                    // handle doors
                    let door_dirs = NO_DIR
                    let optional_door_dirs = NO_DIR
                    doors.filter(([x,y,z,dir,optional]) => x === rx && y === ry && z === rz).forEach(([x,y,z,dir,optional]) => {
                        door_dirs |= dir;
                        if (optional) optional_door_dirs |= dir;
                    })
                    if(createMesh) {
                        let useMaterial = info.material || new THREE.MeshBasicMaterial({ color: roomColor, side: THREE.DoubleSide })
                        console.log("Creating")
                        const voxelObject = createVoxel(rx, ry, rz, voxelSize, voxel, door_dirs, optional_door_dirs, useMaterial);
                        info.voxels.add(voxelObject); // Add voxels to the inner group
                        info.material = useMaterial
                    }
                }
            }
        }
        innerGroup.add(info.voxels)
        //info.voxels.position = new THREE.Vector3(8888,y * voxelSize,z * voxelSize);
        info.voxels.position.x = x * voxelSize
        info.voxels.position.y = y * voxelSize
        info.voxels.position.z = z * voxelSize
        //console.log(info.voxels)
    })

    // for (let x = 0; x < array.length; x++) {
    //     for (let y = 0; y < array[x].length; y++) {
    //         for (let z = 0; z < array[x][y].length; z++) {
    //             let voxel, optionalDoors, color;
    //             voxel = arrayHasOptionalDoors || arrayHasColors ? array[x][y][z][0] : array[x][y][z];
    //             optionalDoors = arrayHasOptionalDoors ? array[x][y][z][1] : 0;
    //             color = arrayHasColors ? array[x][y][z][1] : null;
    //             if (voxel === null) continue;
    //             const voxelObject = createVoxel(x, y, z, voxelSize, voxel, optionalDoors);
    //             innerGroup.add(voxelObject); // Add voxels to the inner group
    //         }
    //     }
    // }

    // Calculate the center offset and translate the inner group
    innerGroup.position.set(-totalX / 2, -totalY / 2, -totalZ / 2);

    dungeon.add(innerGroup); // Add the inner group to the outer group

    return dungeon;
}

function getRandomGrayColorInRange(min, max, seed) {
    return parseInt(
        `${Math.floor(seededRandom(seed) * (max - min + 1) + min)
            .toString(16)
            .padStart(2, "0")
            .repeat(3)}`,
        16
    );
}

/**
 * Creates a voxel object for the dungeon.
 * @param {number} x - The x position of the voxel.
 * @param {number} y - The y position of the voxel.
 * @param {number} z - The z position of the voxel.
 * @param {number} voxel - The voxel data (bit flags).
 * @param {number} size - The size of the voxel.
 * @returns {THREE.Object3D} - The Three.js object representing the voxel.
 */
function createVoxel(x, y, z, size, voxel, doors = 0, optionalDoors = 0, useMaterial = null) {
    const voxelGroup = new THREE.Group();

    // Generate a random shade of gray
    let faceMaterial = useMaterial || new THREE.MeshBasicMaterial({ color: getRandomGrayColorInRange(100, 200), side: THREE.DoubleSide });

    const voxelPosition = {
        x: x * size + size / 2,
        y: y * size + size / 2,
        z: z * size + size / 2,
    };

    const wireframeInset = 0.005; // Small inset for the wireframe

    const createFace = (directionFlag, positionOffset, rotation) => {
        if (voxel & directionFlag) {
            let isDoor = directionFlag & doors;
            let isOptionalDoor = directionFlag & optionalDoors
            let _faceMaterial = faceMaterial
            const faceGeometry = new THREE.PlaneGeometry(size, size);
            if (isDoor) {
                _faceMaterial = new THREE.MeshBasicMaterial({ color: isOptionalDoor ? 0xffff00 : 0x00ff00, side: THREE.DoubleSide })
                _faceMaterial.transparent = true;
                _faceMaterial.opacity = 0.45;
            }
            const face = new THREE.Mesh(faceGeometry, _faceMaterial);
            face.position.set(voxelPosition.x + positionOffset.x, voxelPosition.y + positionOffset.y, voxelPosition.z + positionOffset.z);
            face.rotation.set(rotation.x, rotation.y, rotation.z);

            // Create a slightly smaller wireframe geometry
            const wireframeGeometry = new THREE.PlaneGeometry(size - wireframeInset, size - wireframeInset);
            const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
            const wireframe = new THREE.LineSegments(new THREE.EdgesGeometry(wireframeGeometry), wireframeMaterial);
            wireframe.position.copy(face.position);
            wireframe.rotation.copy(face.rotation);

            voxelGroup.add(face);
            voxelGroup.add(wireframe);
        }
    };

    size *= 0.999; // prevent z fighting
    // Adjust positionOffset for each face to be relative to voxelPosition
    createFace(FRONT, { x: 0, y: 0, z: size / 2 }, { x: 0, y: 0, z: 0 });
    createFace(BACK, { x: 0, y: 0, z: -size / 2 }, { x: 0, y: Math.PI, z: 0 });
    createFace(RIGHT, { x: size / 2, y: 0, z: 0 }, { x: 0, y: Math.PI / 2, z: 0 });
    createFace(LEFT, { x: -size / 2, y: 0, z: 0 }, { x: 0, y: -Math.PI / 2, z: 0 });
    createFace(TOP, { x: 0, y: size / 2, z: 0 }, { x: -Math.PI / 2, y: 0, z: 0 });
    createFace(BOTTOM, { x: 0, y: -size / 2, z: 0 }, { x: Math.PI / 2, y: 0, z: 0 });

    return voxelGroup;
}

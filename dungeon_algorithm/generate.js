let placedRooms = []; // element format: [room, x, y, z, immovable]

function getPlacedRoomsAsArray(x_size, y_size, z_size) {
    let arr = make3DArray(x_size, y_size, z_size, [null, 0, null]);
    placedRooms.forEach(([room, x, y, z]) => {
        let { floorPlan, array3D } = room;

        var room_color = getRandomGrayColorInRange(100, 200);
        floorPlan.forEach(([x2, y2, z2, doors, optional_doors]) => {
            let renderDoors = array3D[x2][y2][z2];
            arr[x + x2][y + y2][z + z2] = [renderDoors, optional_doors & doors, room_color];
        });
    });
    return arr;
}

function getPlacedRoomsAsRenderableArray(x_size, y_size, z_size) {
    let arr = getPlacedRoomsAsArray(x_size, y_size, z_size);

    var renderArr = make3DArray(x_size, y_size, z_size, [0, null]);
    loopThrough3DArray(arr, (val, x, y, z) => {
        let [doors, optional_door_modifier, color] = val;

        // Fill unused optional doors in as walls for render
        if (optional_door_modifier & LEFT && getFrom3DArray(arr, x - 1, y, z, [null])[0] === null) doors &= ALL_DIRS ^ LEFT;
        if (optional_door_modifier & RIGHT && getFrom3DArray(arr, x + 1, y, z, [null])[0] === null) doors &= ALL_DIRS ^ RIGHT;
        if (optional_door_modifier & BOTTOM && getFrom3DArray(arr, x, y - 1, z, [null])[0] === null) doors &= ALL_DIRS ^ BOTTOM;
        if (optional_door_modifier & TOP && getFrom3DArray(arr, x, y + 1, z, [null])[0] === null) doors &= ALL_DIRS ^ TOP;
        if (optional_door_modifier & FRONT && getFrom3DArray(arr, x, y, z + 1, [null])[0] === null) doors &= ALL_DIRS ^ FRONT;
        if (optional_door_modifier & BACK && getFrom3DArray(arr, x, y, z - 1, [null])[0] === null) doors &= ALL_DIRS ^ BACK;

        if (optional_door_modifier & LEFT && !(getFrom3DArray(arr, x - 1, y, z, [0])[0] & RIGHT)) doors &= ALL_DIRS ^ LEFT;
        if (optional_door_modifier & RIGHT && !(getFrom3DArray(arr, x + 1, y, z, [0])[0] & LEFT)) doors &= ALL_DIRS ^ RIGHT;
        if (optional_door_modifier & BOTTOM && !(getFrom3DArray(arr, x, y - 1, z, [0])[0] & TOP)) doors &= ALL_DIRS ^ BOTTOM;
        if (optional_door_modifier & TOP && !(getFrom3DArray(arr, x, y + 1, z, [0])[0] & BOTTOM)) doors &= ALL_DIRS ^ TOP;
        if (optional_door_modifier & FRONT && !(getFrom3DArray(arr, x, y, z + 1, [0])[0] & BACK)) doors &= ALL_DIRS ^ FRONT;
        if (optional_door_modifier & BACK && !(getFrom3DArray(arr, x, y, z - 1, [0])[0] & FRONT)) doors &= ALL_DIRS ^ BACK;

        renderArr[x][y][z] = [doors, color];
    });
    return renderArr;
}

function placeInitialRooms() {
    Object.entries(rooms).forEach(([name, room]) => {
        if (name === "EntranceRoom" || room.isCorridor) return;
        let count = room.minCount;
        while (count-- > 0) placedRooms.push([room, Math.floor(settings.x_size / 2), Math.floor(settings.y_size / 2), Math.floor(settings.z_size / 2), false]);
    });
}

function calculateMTV(aabb1, aabb2) {
    // Calculate the overlap on each axis
    const overlapX = Math.min(aabb1.x + aabb1.x_size, aabb2.x + aabb2.x_size) - Math.max(aabb1.x, aabb2.x);
    const overlapY = Math.min(aabb1.y + aabb1.y_size, aabb2.y + aabb2.y_size) - Math.max(aabb1.y, aabb2.y);
    const overlapZ = Math.min(aabb1.z + aabb1.z_size, aabb2.z + aabb2.z_size) - Math.max(aabb1.z, aabb2.z);

    // Check if there is no overlap (no collision)
    if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) {
        return null; // No collision
    }

    // Find the smallest overlap
    const smallestOverlap = Math.min(overlapX, overlapY, overlapZ);

    // Determine the MTV based on the smallest overlap
    let mtvX = 0,
        mtvY = 0,
        mtvZ = 0;
    if (smallestOverlap === overlapX) {
        mtvX = aabb1.x < aabb2.x ? -overlapX : overlapX;
    } else if (smallestOverlap === overlapY) {
        mtvY = aabb1.y < aabb2.y ? -overlapY : overlapY;
    } else {
        mtvZ = aabb1.z < aabb2.z ? -overlapZ : overlapZ;
    }

    // Return the MTV as an object with x, y, and z components
    return { x: mtvX, y: mtvY, z: mtvZ };
}

function constrainPlacedRoomToDungeon(placedRoom) {
    placedRoom[1] = Math.min(settings.x_size - placedRoom[0].x_size, Math.max(0, placedRoom[1]));
    placedRoom[2] = Math.min(settings.y_size - placedRoom[0].y_size, Math.max(0, placedRoom[2]));
    placedRoom[3] = Math.min(settings.z_size - placedRoom[0].z_size, Math.max(0, placedRoom[3]));
}

function separateRooms(maxIterations = 1000) {
    let allRoomsSeparated = false;

    while (!allRoomsSeparated && --maxIterations > 0) {
        // Placed rooms should be pushed away from each other via their AABBS
        // Should also be pushed away from walls/not allowed to be pushed outside the dungeon
        // We need to continue continue running this function until our rooms have all been separated

        for (let i = 0; i < placedRooms.length; i++) {
            const [room_a, ax, ay, az, a_immovable] = placedRooms[i];

            for (let j = i + 1; j < placedRooms.length; j++) {
                const [room_b, bx, by, bz, b_immovable] = placedRooms[j];
                if (b_immovable) continue;

                let mtv = calculateMTV({ ...room_a, x: ax, y: ay, z: az }, { ...room_b, x: bx, y: by, z: bz });
                if (mtv) {
                    placedRooms[j][1] -= mtv.x;
                    placedRooms[j][2] -= mtv.y;
                    placedRooms[j][3] -= mtv.z;
                    constrainPlacedRoomToDungeon(placedRooms[j]);
                }
            }
        }
    }

    return allRoomsSeparated;
}

function generateDungeon(x_size, y_size, z_size) {
    placedRooms = [];
    placedRooms.push([rooms["EntranceRoom"], Math.floor(x_size / 2), Math.floor(y_size / 2), 0, true]);
    // placeRoom(arr, rooms["Optional side doors"], Math.floor(x_size / 2), Math.floor(y_size / 2), 1);
    // placeRoom(arr, rooms["Optional side doors"], Math.floor(x_size / 2), Math.floor(y_size / 2), 2);
    // placeRoom(arr, rooms["Optional side doors"], Math.floor(x_size / 2) + 1, Math.floor(y_size / 2), 0);
    // placeRoom(arr, rooms["Flat 3x3 box with hole"], Math.floor(x_size / 2) - 1, Math.floor(y_size / 2), 3);

    placeInitialRooms();
    console.log(separateRooms());

    return getPlacedRoomsAsRenderableArray(x_size, y_size, z_size);
}

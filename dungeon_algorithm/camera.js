let isFlyMode = false;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationSpeed = 0.005;
let zoomSpeed = 0.01;
let targetZoom = 0;
let zoomInterpolationFactor = 0.1;
let flySpeed = 0.1;
let keys = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    Space: false,
    Shift: false,
};
let focusedObject;

let orbitCenter = new THREE.Vector3(); // Center of the orbit
let orbitRadius = 10; // Distance from the center
let azimuthAngle = 0; // Horizontal angle
let polarAngle = Math.PI / 2; // Vertical angle
let minPolarAngle = 0.1; // Minimum polar angle (to prevent flipping)
let maxPolarAngle = Math.PI - 0.1; // Maximum polar angle

let lastFrameTime = Date.now();
function updateCamera(camera) {
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    if (settings.cameraFlyMode) {
        const forward = new THREE.Vector3(0, 0, -1);
        const right = new THREE.Vector3(1, 0, 0);
        // Transform the forward and right vectors to camera space
        forward.applyQuaternion(camera.quaternion);
        right.applyQuaternion(camera.quaternion);

        targetZoom = camera.position.z;
        //console.log(keys.w)

        if (keys["KeyW"]) camera.position.addScaledVector(forward, flySpeed);
        if (keys["KeyS"]) camera.position.addScaledVector(forward, -flySpeed);
        if (keys["KeyD"]) camera.position.addScaledVector(right, flySpeed);
        if (keys["KeyA"]) camera.position.addScaledVector(right, -flySpeed);
    } else {
        // Calculate new camera position for orbit
        let x = orbitRadius * Math.sin(polarAngle) * Math.cos(azimuthAngle);
        let y = orbitRadius * Math.cos(polarAngle);
        let z = orbitRadius * Math.sin(polarAngle) * Math.sin(azimuthAngle);

        if (settings.auto_rotate) {
            azimuthAngle -= 0.4 * deltaTime;
        }

        camera.position.set(x, y, z);
        camera.lookAt(orbitCenter);

        localStorage.setItem("orbit_polar_azimuth", [orbitRadius, polarAngle, azimuthAngle]);
    }
}

function setupCameraControls(camera) {
    function onKeyDown(event) {
        //event.preventDefault();
        const key = event.code; // Use event.code instead of event.key
        if (!keys[key]) {
            // Check if the key state is already true
            keys[key] = true;
        }
    }

    function onKeyUp(event) {
        //event.preventDefault();
        const key = event.code; // Use event.code
        keys[key] = false;
    }

    function resetKeys() {
        for (let key in keys) {
            keys[key] = false;
        }
    }

    function onBlur() {
        resetKeys();
    }

    function onMouseDown(event) {
        if (event.button !== 0) return;
        isDragging = true;
        if (settings.cameraFlyMode) document.querySelector("canvas").requestPointerLock();
    }

    function onMouseMove(event) {
        const deltaX = event.clientX - previousMousePosition.x;
        const deltaY = event.clientY - previousMousePosition.y;

        if (settings.cameraFlyMode && document.pointerLockElement === document.querySelector("canvas")) {
            // Horizontal rotation (yaw)
            camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -event.movementX * rotationSpeed);

            // Vertical rotation (pitch)
            let pitchChange = -event.movementY * rotationSpeed;
            let currentPitch = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ").x;
            let maxPitch = Math.PI / 2;
            let minPitch = -Math.PI / 2;
            pitchChange = Math.max(minPitch - currentPitch, Math.min(maxPitch - currentPitch, pitchChange));

            camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), pitchChange);
        } else {
            if (isDragging) {
                azimuthAngle -= -deltaX * rotationSpeed;
                polarAngle -= deltaY * rotationSpeed;
                polarAngle = Math.max(minPolarAngle, Math.min(maxPolarAngle, polarAngle));
            }
        }

        previousMousePosition = {
            x: event.clientX,
            y: event.clientY,
        };
    }

    function onMouseUp(event) {
        if (event.button !== 0) return;
        isDragging = false;
    }

    function onWheel(event) {
        orbitRadius += event.deltaY * zoomSpeed;
        orbitRadius = Math.min(30, Math.max(1, orbitRadius)); // Prevent negative radius
    }

    document.addEventListener("keydown", onKeyDown, false);
    document.addEventListener("keyup", onKeyUp, false);
    document.querySelector("canvas").addEventListener("mousedown", onMouseDown, false);
    document.querySelector("canvas").addEventListener("mousemove", onMouseMove, false);
    document.querySelector("canvas").addEventListener("mouseup", onMouseUp, false);
    document.querySelector("canvas").addEventListener("wheel", onWheel, false);
    window.addEventListener("blur", onBlur, false);

    let orbit_polar_azimuth = (localStorage.getItem("orbit_polar_azimuth") || "").split(",").map(parseFloat);
    if(orbit_polar_azimuth && orbit_polar_azimuth.length === 3) {
        orbitRadius = orbit_polar_azimuth[0]
        polarAngle = orbit_polar_azimuth[1]
        azimuthAngle = orbit_polar_azimuth[2]
    }
}

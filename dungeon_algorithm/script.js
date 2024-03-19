 let scene, camera, renderer;

let dungeonGroup = new THREE.Group();
roomGroup = new THREE.Group();

function init() {
    // init gui
    setupGUI();

    // Create the scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Create and position the camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    targetZoom = camera.position.z = 20;

    // Create the renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Handle window resize
    window.addEventListener("resize", onWindowResize, false);

    setupCameraControls(camera);

    startGeneratingDungeon();

    // Start the animation loop
    animate();
}

let lastUpdateTime = Date.now()
let updateFreq = 50
var cur_shown_room = ""
function animate() {
    requestAnimationFrame(animate);

    updateCamera(camera);
    if((Date.now() - lastUpdateTime > updateFreq) && updateDungeonGen()) {
        lastUpdateTime = Date.now()
        if(dungeonGroup) {
            scene.remove(dungeonGroup)
        }
        dungeonGroup = createDungeonRender(dungeon, 1, true, false, true); // Assuming each voxel is of size 1
        scene.add(dungeonGroup);
        focusedObject = dungeonGroup;
    }

    if (settings.selectedRoom == "None") {
        dungeonGroup.visible = true;
        roomGroup.visible = false;
    } else {
        dungeonGroup.visible = false;
        roomGroup.visible = true;
        if(cur_shown_room != settings.selectedRoom) {
            if(roomGroup) scene.remove(roomGroup)
            roomGroup = createDungeonRender([[0,0,0,rooms[settings.selectedRoom]]], 1, false, true)
            scene.add(roomGroup)
            cur_shown_room = settings.selectedRoom
        }
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();

let settings;

function setupGUI(onRegenerate) {
    // Assuming you have an array of room names
    const roomNames = getRoomsList();
    const roomsSettings = {};
    roomNames.forEach((r) => (roomsSettings[r] = true));

    // Define the settings object
    settings = {
        cameraFlyMode: false,
        rooms: roomsSettings,
        selectedRoom: localStorage.getItem("selectedRoom") || "None", // Default to the first room
        seed: generateSeed,//3830131756222209,//generateSeed,
        roomName: "",
        x_size: parseInt(localStorage.getItem("x_size")) || 10,
        y_size: parseInt(localStorage.getItem("y_size")) || 10,
        z_size: parseInt(localStorage.getItem("z_size")) || 10,
        auto_rotate: !!JSON.parse(localStorage.getItem("auto_rotate")),
        regenerate: function () {
            startGeneratingDungeon();
        },
    };

    // Initialize dat.GUI
    const gui = new dat.GUI({ autoPlace: false, width: 400 });
    document.getElementById("gui-container").appendChild(gui.domElement);

    // Add new room button
    gui.add(settings, "cameraFlyMode").name("Enable camera fly mode");

    // Add dropdown for room selection
    gui.add(settings, "selectedRoom", ["None", ...roomNames])
        .name("Display Room")
        .onChange((selectedRoom) => {
            settings.selectedRoom = selectedRoom;
            localStorage.setItem("selectedRoom", selectedRoom);
        });

    gui.add(settings, "x_size").name("Map X size").onChange(x_size => localStorage.setItem("x_size", x_size));
    gui.add(settings, "y_size").name("Map Y size").onChange(y_size => localStorage.setItem("y_size", y_size));
    gui.add(settings, "z_size").name("Map Z size").onChange(z_size => localStorage.setItem("z_size", z_size));
    gui.add(settings, "auto_rotate").name("Auto Rotate").onChange(auto_rotate => localStorage.setItem("auto_rotate", auto_rotate));

    // Add seed number input
    gui.add(settings, "seed")
        .name("Seed")
        .onChange((newSeed) => {
            settings.seed = newSeed;
        });

    // Add regenerate button
    gui.add(settings, "regenerate").name("Regenerate");

    return settings;
}

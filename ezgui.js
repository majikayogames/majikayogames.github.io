function updateInputWithValue(path, value) {
    const inputElement = document.querySelector(`[data-path='${path}']`);
    if (inputElement) {
        if (inputElement.type === "checkbox") {
            inputElement.checked = value;
        } else if (inputElement.tagName.toLowerCase() === "select") {
            inputElement.value = value;
        } else {
            inputElement.value = value;
        }
    }
}

function transformDataProperties(data, path, callbacks = {}) {
    Object.keys(data).forEach((key) => {
        let internalValue = data[key];
        const currentPath = [...path, key].join(".");

        if (Array.isArray(internalValue)) {
            data[key] = internalValue[0]; // Set the data object to the first value of the array by default
        }

        if (typeof internalValue !== "object" || internalValue instanceof Function || Array.isArray(internalValue)) {
            Object.defineProperty(data, key, {
                get() {
                    return internalValue;
                },
                set(newValue) {
                    internalValue = newValue;
                    updateInputWithValue(currentPath, newValue);
                    const catchallCallback = callbacks["*"];
                    const specificCallback = callbacks[currentPath];
                    if (specificCallback) {
                        specificCallback(newValue, currentPath);
                    }
                    if (catchallCallback) {
                        catchallCallback(newValue, currentPath);
                    }
                },
                enumerable: true,
                configurable: true,
            });
        } else if (typeof internalValue === "object" && !Array.isArray(internalValue) && internalValue !== null) {
            transformDataProperties(internalValue, [...path, key], callbacks); // Recursive call for nested objects
        }
    });
}

function generateForm(dataObject, path) {
    const formContainer = document.createElement("div");

    const setPathValue = (path, value) => {
        let tempData = dataObject;
        for (let i = 0; i < path.length - 1; i++) {
            tempData = tempData[path[i]];
        }
        tempData[path[path.length - 1]] = value;
    }

    let nestedObjForRecur = dataObject;
    for(let i = 0; i < path.length; i++) {
        nestedObjForRecur = nestedObjForRecur[path[i]];
    }

    Object.entries(nestedObjForRecur).forEach(([key, value]) => {
        const currentPath = [...path, key];

        if (typeof value === "function") {
            // Make functions buttons
            const button = document.createElement("button");
            button.classList.add("control");
            button.textContent = key;
            button.onclick = value;
            formContainer.appendChild(button);
        } else if (Array.isArray(value)) {
            // Make arrays dropdowns
            const label = document.createElement("label");
            const labelText = document.createElement("span");
            labelText.innerText = key;
            labelText.title = key;
            labelText.classList.add("text")
            label.appendChild(labelText);

            const select = document.createElement("select");
            select.setAttribute("data-path", currentPath);
            value.forEach((option) => {
                const optionElement = document.createElement("option");
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            });
            select.value = value[0]; // Default to first array element
            select.addEventListener("change", (e) => {
                setPathValue(currentPath, select.options[select.selectedIndex].value);
            });

            const control = document.createElement("span");
            control.classList.add("control");
            control.appendChild(select);
            label.appendChild(control);
            formContainer.appendChild(label);
        } else if (typeof value === "object" && !Array.isArray(value) && value !== null) {
            // Make nested objects collapsible sections
            const button = document.createElement("button");
            button.className = "collapsible";
            button.innerText = key;

            const contentDiv = document.createElement("div");
            contentDiv.className = "collapsible-content";
            contentDiv.appendChild(generateForm(dataObject, currentPath)); // Recursive call for nested objects
            contentDiv.style.display = "none";

            button.addEventListener("click", function () {
                contentDiv.style.display = contentDiv.style.display === "none" ? "block" : "none";
                if (contentDiv.style.display === "none") {
                    button.classList.remove("expanded");
                } else {
                    button.classList.add("expanded");
                }
            });

            formContainer.appendChild(button);
            formContainer.appendChild(contentDiv);
        } else {
            // Make text, boolean, or numbers as text, checkbox, or number inputs
            const label = document.createElement("label");
            const labelText = document.createElement("span");
            labelText.innerText = key;
            labelText.title = key;
            labelText.classList.add("text")
            label.appendChild(labelText);

            let inputType = "text";
            if (typeof value === "boolean") {
                inputType = "checkbox";
            } else if (typeof value === "number") {
                inputType = "number";
            }

            const input = document.createElement("input");
            input.type = inputType;
            input.setAttribute("data-path", currentPath.join("."));
            input.name = currentPath.join(".");
            input.value = inputType === "checkbox" ? "" : value;
            input.checked = inputType === "checkbox" ? value : false;

            input.addEventListener("input", (e) => {
                const newValue = inputType === "checkbox" ? input.checked : input.value;
                setPathValue(currentPath, inputType === "number" ? Number(newValue) : newValue);
            });

            const control = document.createElement("span");
            control.classList.add("control");
            control.appendChild(input);
            label.appendChild(control);
            formContainer.appendChild(label);
        }
    });

    return formContainer;
}

const palettes = {
    default: {
        primaryText: "#2FA1CC",
        highlightText: "#FFF",
        primaryBackground: "#303030",
        secondaryBackground: "#3C3C3C",
        tertiaryBackground: "#1A1A1A",
        accentBackground: "#000",
    },
};

function injectStyles(palette) {
    const styles = `
        .ezgui-floating-window {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 400px;
            max-width: 100%;
            background-color: ${palette.tertiaryBackground};
            color: ${palette.primaryText};
            font: 11px 'Lucida Grande', sans-serif;
        }

        button.ezgui-close-controls, button.collapsible {
            width: 100%;
            background-color: ${palette.accentBackground};
            color: ${palette.highlightText};
            font-size: 11px;
            border: none;
            padding: 7px;
            cursor: pointer;
            position: relative;
            border-radius: 0; /* Consistent border radius */
        }
        button.collapsible {
            text-align: left;
            border-bottom: 1px solid ${palette.secondaryBackground};
            user-select: none;
            -webkit-user-select: none; /* Safari */
            -ms-user-select: none; /* IE 10 and IE 11 */
        }
        .collapsible-content {
            border-left: 5px solid ${palette.accentBackground};
        }

        button.ezgui-close-controls:hover, button.collapsible:hover {
            background-color: ${palette.secondaryBackground};
        }

        button.collapsible::before {
            content: '';
            display: inline-block;
            width: 7px;
            height: 7px;
            background-image: url(${'data:image/svg+xml;base64,'+btoa("<svg xmlns='http://www.w3.org/2000/svg' width='5' height='5' viewBox='0 0 5 5'><polygon points='2,0 5,2.5 2,5' fill='"+palette.highlightText+"'/></svg>")});
            background-size: contain;
            background-repeat: no-repeat;
            margin-right: 8px;
            vertical-align: middle;
        }
        
        button.collapsible.expanded::before {
            background-image: url(${'data:image/svg+xml;base64,'+btoa("<svg xmlns='http://www.w3.org/2000/svg' width='5' height='5' viewBox='0 0 5 5'><polygon points='0,2 5,2 2.5,5' fill='"+palette.highlightText+"'/></svg>")});
        }
        
        .ezgui-floating-window label {
            display: block;
            padding: 4px;
            cursor: pointer;
            border-bottom: 1px solid ${palette.secondaryBackground};
            color: ${palette.highlightText};
            overflow: hidden;
            white-space: nowrap; /* Correct property for no wrapping */
        }

        .ezgui-floating-window label > .text, .ezgui-floating-window label > .control {
            display: inline-block;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .ezgui-floating-window label > .text {
            width: 40%;
            border-radius: 0px;
            border: 0px;
            padding: 0 4px 0 5px;
            user-select: none;
            -webkit-user-select: none; /* Safari */
            -ms-user-select: none; /* IE 10 and IE 11 */
        }

        .ezgui-floating-window label > .control {
            text-align: left;
            width: 60%;
        }

        .ezgui-floating-window button.control {
            padding: 4px 4px 4px 9px;
            text-align: left;
            background-color: transparent;
            color: ${palette.highlightText};
            border: 0px;
            width: 100%;
        }
        .ezgui-floating-window button.control:hover {
            background-color: ${palette.secondaryBackground};
            cursor: pointer;
            color: ${palette.highlightText};
            border: 0px;
            width: 100%;
        }

        .ezgui-floating-window input {
            background-color: ${palette.primaryBackground};
            color: ${palette.primaryText};
            border: 1px solid ${palette.secondaryBackground}; /* Slight border for definition */
            padding: 2px 4px; /* Padding for better text visibility */
            border-radius: 2px; /* Slight border radius */
        }
        .ezgui-floating-window input[type="text"], .ezgui-floating-window input[type="number"] {
            outline: none;
        }
        .ezgui-floating-window select {
            outline: none;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}


function makeGui(data, callbacks, options) {
    transformDataProperties(data, [], callbacks); // Initialize data properties transformation with an empty base path. Adds callbacks/setters/getters for watching data.
    const form = generateForm(data, [], callbacks);
    const floatingWindow = document.createElement("div");

    const closeControlsButton = document.createElement("button");
    closeControlsButton.innerText = "Close Controls";
    closeControlsButton.title = "Alt-Click to hide entire window, H to bring it back.";
    closeControlsButton.classList.add("ezgui-close-controls");

    floatingWindow.appendChild(form);
    floatingWindow.appendChild(closeControlsButton);
    floatingWindow.classList.add("ezgui-floating-window");

    closeControlsButton.onclick = (e) => {
        if(e.altKey) {
            floatingWindow.style.display = "none";
            let bringBackListener = {};
            bringBackListener.listener = document.addEventListener("keypress", (e) => {
                if(e.key === "h" || e.key === "H") {
                    floatingWindow.style.display = "";
                    document.removeEventListener("keypress", bringBackListener.listener);
                }
            })
        }
        else {
            form.style.display = form.style.display === "none" ? "" : "none";
            closeControlsButton.innerText = form.style.display === "none" ? "Open Controls" : "Close Controls";
        }
    }

    let container = window?.ez?.canvas || options?.container || document.body;
    container.appendChild(floatingWindow);

    if (!options?.noStyling) {
        injectStyles(palettes[options?.palette || "default"]); // Inject the generated styles
    }

    return floatingWindow;
}

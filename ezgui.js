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
        const currentPath = path ? `${path}.${key}` : key;

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
            transformDataProperties(internalValue, currentPath, callbacks); // Recursive call for nested objects
        }
    });
}

function generateForm(dataObject, path, callbacks) {
    const formContainer = document.createElement("div");

    Object.entries(dataObject).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === "function") {
            // Make functions buttons
            const button = document.createElement("button");
            button.textContent = key;
            button.onclick = value;
            formContainer.appendChild(button);
        } else if (Array.isArray(value)) {
            // Make arrays dropdowns
            const label = document.createElement("label");
            label.htmlFor = currentPath;
            label.textContent = key;

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
                const selectedValue = select.options[select.selectedIndex].value;
                // Update data object based on selection
                const pathParts = currentPath.split(".");
                let tempData = dataObject;
                for (let i = 0; i < pathParts.length - 1; i++) {
                    tempData = tempData[pathParts[i]];
                }
                tempData[pathParts[pathParts.length - 1]] = selectedValue;
            });

            formContainer.appendChild(label);
            formContainer.appendChild(select);
            formContainer.appendChild(document.createElement("br"));
        } else if (typeof value === "object" && !Array.isArray(value) && value !== null) { // Make nested objects collapsible sections
            const button = document.createElement("button");
            button.className = "collapsible";
            button.innerText = key;

            const contentDiv = document.createElement("div");
            contentDiv.className = "content";
            contentDiv.appendChild(generateForm(value, currentPath, callbacks)); // Recursive call for nested objects
            contentDiv.style.display = "none"

            button.addEventListener("click", function () {
                contentDiv.style.display = contentDiv.style.display === "none" ? "block" : "none"
                if(contentDiv.style.display === "none") {
                    contentDiv.classList.add("expanded")
                }
                else {
                    contentDiv.classList.remove("expanded")
                }
            });

            formContainer.appendChild(button);
            formContainer.appendChild(contentDiv);
        } else {
            // Make text, boolean, or numbers as text, checkbox, or number inputs
            const label = document.createElement("label");
            label.htmlFor = currentPath;
            label.textContent = key;

            let inputType = "text";
            if (typeof value === "boolean") {
                inputType = "checkbox";
            } else if (typeof value === "number") {
                inputType = "number";
            }

            const input = document.createElement("input");
            input.type = inputType;
            input.setAttribute("data-path", currentPath);
            input.id = currentPath;
            input.name = currentPath;
            input.value = inputType === "checkbox" ? "" : value;
            input.checked = inputType === "checkbox" ? value : false;

            input.addEventListener("input", (e) => {
                const newValue = inputType === "checkbox" ? input.checked : input.value;
                // Dynamically update nested property based on the path
                const pathParts = currentPath.split(".");
                let tempData = dataObject;
                for (let i = 0; i < pathParts.length - 1; i++) {
                    tempData = tempData[pathParts[i]];
                }
                tempData[pathParts[pathParts.length - 1]] = inputType === "number" ? Number(newValue) : newValue;
            });

            formContainer.appendChild(label);
            formContainer.appendChild(input);
            formContainer.appendChild(document.createElement("br"));
        }
    });

    return formContainer;
}

const palletes = {
    default: {
        textColor: "#fff",
        backgroundColor: "#1A1A1A",
        borderColor: "#6272a4",
        collapsibleBackgroundColor: "#fff",
        contentBackgroundColor: "#383a59"
    }
}

function injectStyles(palette) {
    const styles = `
        .ezgui-floating-window {
            position: absolute;
            top: 10px;
            right: 10px;
            min-width: 250px;
            max-width: 500px;
            background-color: ${palette.backgroundColor};
            color: ${palette.textColor};
        }
        .ezgui-close-controls {
            width: 100%;
        }

        .gui-container {
            font-family: Arial, sans-serif;
            color: ${palette.textColor};
            background-color: ${palette.backgroundColor};
            border: 1px solid ${palette.borderColor};
            padding: 10px;
        }
        .gui-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }
        .gui-label {
            flex: 1;
        }
        .gui-input, .gui-select, .gui-button {
            flex: 2;
        }
        .collapsible {
            cursor: pointer;
            border: none;
            text-align: left;
            outline: none;
            font-size: 15px;
            background-color: ${palette.collapsibleBackgroundColor};
            color: ${palette.textColor};
        }
        .collapsible:after {
            content: '\\25B6';
            color: ${palette.textColor};
            float: right;
        }
        .collapsible.expanded:after {
            content: '\\25BC';
        }
        .content {
            padding: 0 18px;
            display: none;
            overflow: hidden;
            background-color: ${palette.contentBackgroundColor};
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}

function makeGui(data, callbacks, options) {
    transformDataProperties(data, "", callbacks); // Initialize data properties transformation with an empty base path. Adds callbacks/setters/getters for watching data.
    const form = generateForm(data, "", callbacks);
    const floatingWindow = document.createElement("div");
    
    const closeControlsButton = document.createElement("button");
    closeControlsButton.innerText = "Close Controls";
    closeControlsButton.title = "Alt-Click to hide entire window, H to bring it back";
    closeControlsButton.classList.add("ezgui-close-controls");

    floatingWindow.appendChild(form);
    floatingWindow.appendChild(closeControlsButton);
    floatingWindow.classList.add("ezgui-floating-window")
    let container = window?.ez?.canvas || options?.container || document.body;
    container.appendChild(floatingWindow);

    if(!options?.noStyling) {
        injectStyles(palletes[options?.pallete || "default"]); // Inject the generated styles
    }

    return floatingWindow;
}

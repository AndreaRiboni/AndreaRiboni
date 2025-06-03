// ------------------ CONFIG ------------------
let username, cwd, terminal, promptSpan, input, activeLine, textSizer;

// Use window.onload to ensure the DOM is fully loaded before accessing elements
window.onload = (event) => {
    username = "guest";
    cwd = "/home/guest";       // starting working dir
    terminal = document.getElementById("terminal");
    promptSpan = document.getElementById("prompt");
    input = document.getElementById("cmd");
    activeLine = document.getElementById("activeLine");
    textSizer = document.getElementById("text-sizer");

    // Initialize the prompt and display the welcome message after elements are loaded
    setPrompt();
    appendOutput("Welcome to reebo.it! Type 'help' to get started.\n");
    updateInputWidth(); // Ensure input width is correct on load

    // Handle command input - moved inside window.onload
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const raw = input.value.trim();
            if (!raw) return;
            commitLine(raw);
            runCommand(raw);
            input.value = "";       // clear for next entry
            updateInputWidth();
        } else if (e.key === "Tab") {
            e.preventDefault();
            performTabCompletion();
        }
    });

    // Autofocus input even after any tap/click - moved inside window.onload
    document.addEventListener("click", () => input.focus());

    // Enhanced mobile touch handling - moved inside window.onload
    document.addEventListener("touchstart", (e) => {
        input.focus();
    });

    // Attach input event listener for width update - moved inside window.onload
    input.addEventListener("input", updateInputWidth);
};


// Fake filesystem (for cd/ls/cat demo)
const fs = {
    "/": ["home"],
    "/home": ["guest"],
    "/home/guest": ["README.md", "projects", "education", "contact"],
    "/home/guest/projects": ["README.md"],
    "/home/guest/education": ["README.md"],
    "/home/guest/contact": ["README.md"],
};

// File contents for the cat command
const fileContents = {
    "/home/guest/README.md": `Welcome guest! I am Andrea - this webpage's owner.`,
    "/home/guest/projects/README.md": `Here you will eventually find a collection of my personal and professional coding projects.`,
    "/home/guest/education/README.md": `BSc computer engineering @ polimi. MSc Double Degree ("EIT Digital") in Data Science between polimi and aalto university. Thesis was on LLM of course.`,
    "/home/guest/contact/README.md": `Want to get in touch? Find me on LinkedIn: https://www.linkedin.com/in/andrea-riboni/`,
};

// ------------------ COMMAND TABLE ------------------
const commands = {
    help() {
        return (
    `Available commands:
    · help              this help message
    · ls [dir]          list items
    · cd <dir|..|/>     change directory
    · whoami            show current user
    · cat <file>        show file contents
    · openreebo         go back to the homepage  `);
    },

    ls(args) {
        const pathToList = resolvePath(args[0] ?? cwd);
        const listing = fs[pathToList];
        if (!listing) return `ls: cannot access '${args[0] ?? pathToList}': No such file or directory`;
        return listing.join("    ");
    },

    cd(args) {
        if (!args[0]) return "";
        const target = resolvePath(args[0]);
        if (!fs[target]) return `cd: ${args[0]}: No such directory`;
        cwd = target;
        return "";
    },

    whoami() {
        return username;
    },

    cat(args) {
        if (!args[0]) return "cat: missing operand";
        const targetFile = resolvePath(args[0]);
        const contents = fileContents[targetFile];
        if (!contents) return `cat: ${args[0]}: No such file`;
        return contents;
    },
    openreebo() {
        window.location.href = "https://reebo.it/";
        return "Redirecting to reebo.it...";
    },

};

// ------------------ TAB COMPLETION ------------------
function getCompletions(partial) {
    const parts = partial.split(/\s+/);
    const cmd = parts[0];

    // Complete command names
    if (parts.length === 1) {
        return Object.keys(commands).filter(c => c.startsWith(cmd));
    }

    // Complete file/directory names for specific commands
    if (['ls', 'cd', 'cat'].includes(cmd) && parts.length === 2) {
        const pathPart = parts[1];
        const currentDir = fs[cwd] || [];
        return currentDir.filter(item => item.startsWith(pathPart));
    }

    return [];
}

function performTabCompletion() {
    const currentValue = input.value;
    const completions = getCompletions(currentValue);

    if (completions.length === 1) {
        // Single match - complete it
        const parts = currentValue.split(/\s+/);
        if (parts.length === 1) {
            input.value = completions[0] + ' ';
        } else {
            parts[parts.length - 1] = completions[0];
            input.value = parts.join(' ') + (parts.length > 1 ? ' ' : '');
        }
        updateInputWidth(); // <-- FIX
    } else if (completions.length > 1) {
        appendOutput(completions.join('    '));
        // Find common prefix
        let commonPrefix = completions[0];
        for (let i = 1; i < completions.length; i++) {
            while (!completions[i].startsWith(commonPrefix)) {
                commonPrefix = commonPrefix.slice(0, -1);
            }
        }
        if (commonPrefix.length > 0) {
            const parts = currentValue.split(/\s+/);
            if (parts.length === 1) {
                input.value = commonPrefix;
            } else {
                parts[parts.length - 1] = commonPrefix;
                input.value = parts.join(' ');
            }
            updateInputWidth(); // <-- FIX
        }
    }
}


// ------------------ HELPERS ------------------
function resolvePath(path) {
    if (!path || path === ".") return cwd;
    if (path === "..") {
        if (cwd === "/") return "/";
        return cwd.split("/").slice(0, -1).join("/") || "/";
    }
    if (path.startsWith("/")) return path;
    return cwd === "/" ? `/${path}` : `${cwd}/${path}`;
}

// ------------------ CORE LOGIC ------------------
function setPrompt() {
    const promptText = `${username}@reebo.it:${cwd}$`;
    promptSpan.textContent = promptText;
    promptSpan.setAttribute('data-text', promptText);
}

// Keep the active prompt element available after clearing

function commitLine(text) {
    const line = document.createElement("div");
    line.classList.add("crt-text");
    const promptText = promptSpan.textContent;
    line.innerHTML =
        `<span class="select-none crt-text" data-text="${promptText}">${promptText} </span>${text}`;
    terminal.insertBefore(line, activeLine);
}

function runCommand(raw) {
    const [cmd, ...args] = raw.split(/\s+/);
    const handler = commands[cmd];
    const output = handler ? handler(args) : `${cmd}: command not found`;
    if (output) appendOutput(output);
        setPrompt();
    requestAnimationFrame(() => terminal.scrollTo(0, terminal.scrollHeight));
}

function appendOutput(txt) {
    const out = document.createElement("pre");
    out.textContent = txt;
    out.className = "whitespace-pre-wrap crt-text";
    out.setAttribute('data-text', txt);
    terminal.insertBefore(out, activeLine);
}

function updateInputWidth() {
    const currentText = input.value;

    if (currentText === "") {
        // Explicitly set input width to a minimal value when empty.
        // '1ch' is a good unit for one character's width.
        // This ensures the input field visually shrinks.
        input.style.width = "1ch";
    } else {
        // For non-empty text, measure and set width using the sizer span
        textSizer.textContent = currentText;
        input.style.width = textSizer.offsetWidth + "px";
    }
}
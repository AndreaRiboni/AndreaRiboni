document.addEventListener('DOMContentLoaded', () => {
let hoveringCanvas = false;

const classes = ["book", "envelope", "home", "person", "suitcase", "x"];
const iconMap = {
    "book": "book",
    "envelope": "email",
    "home": "home",
    "person": "person",
    "suitcase": "bag",
    "x": "close"
};

const navigationMap = {
    "home": "home-section",
    "envelope": "contact-section",
    "suitcase": "cv-section",
    "person": "bio-section",
    "book": "education-section",
    "x": "tutorial-section"
};


const sectionNames = {
    "home-section": "Home",
    "tutorial-section": "Tutorial",
    "contact-section": "Contact",
    "cv-section": "CV",
    "bio-section": "Biography",
    "education-section": "Academic Path"
};

let model = null;
let currentSection = "home-section";

const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
ctx.lineWidth = 12;
ctx.lineCap = 'round';
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);

let drawing = false;

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        return [e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top];
    } else {
        return [e.clientX - rect.left, e.clientY - rect.top];
    }
}

canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    ctx.beginPath();
    const [x, y] = getPos(e);
    ctx.moveTo(x, y);
});

canvas.addEventListener('touchstart', (e) => {
    drawing = true;
    ctx.beginPath();
    const [x, y] = getPos(e);
    ctx.moveTo(x, y);
    e.preventDefault();
}, {
    passive: false
});

canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const [x, y] = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
});

canvas.addEventListener('touchmove', (e) => {
    if (!drawing) return;
    const [x, y] = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
}, {
    passive: false
});

canvas.addEventListener('mouseup', () => {
    drawing = false;
    predict();
});

canvas.addEventListener('mouseleave', () => {
    if (drawing) {
        drawing = false;
        predict();
    }
});

canvas.addEventListener('touchend', () => {
    drawing = false;
    predict();
});

canvas.addEventListener('mouseenter', () => {
    hoveringCanvas = true;
});

canvas.addEventListener('mouseleave', () => {
    hoveringCanvas = false;
});


document.getElementById('clear-btn').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    document.getElementById('prediction-result').textContent = 'Draw an icon to navigate';
    Object.values(iconMap).forEach(iconId => {
        const bar = document.getElementById(`bar-${iconId}`);
        if (bar) bar.style.width = '0%';
    });

});

async function predict() {
    if (!model) return;

    const inputTensor = tf.tidy(() => {
        const smallCanvas = document.createElement('canvas');
        smallCanvas.width = 32;
        smallCanvas.height = 32;
        const sctx = smallCanvas.getContext('2d');
        sctx.drawImage(canvas, 0, 0, 32, 32);

        const imgData = sctx.getImageData(0, 0, 32, 32);
        let data = tf.browser.fromPixels(imgData).toFloat();
        data = data.div(255.0).expandDims(0);
        return data;
    });

    const prediction = await model.predict(inputTensor).data();
    const topIdx = prediction.indexOf(Math.max(...prediction));
    const confidence = prediction[topIdx];
    const predictedClass = classes[topIdx];
    let maxProb = 0;
    let bestClass = "";

    classes.forEach((cls, i) => {
        const prob = prediction[i];
        if (prob > maxProb) {
            maxProb = prob;
            bestClass = cls;
        }
        const iconId = iconMap[cls];
        const bar = document.getElementById(`bar-${iconId}`);
        if (bar) bar.style.width = `${(prob * 100).toFixed(1)}%`;
    });

    const resultText = `${bestClass} (${(maxProb * 100).toFixed(1)}%)`;
    document.getElementById('prediction-result').textContent = resultText;


    // Navigate if confidence > 90%
    if (confidence > 0.9) {
        navigateToSection(predictedClass);
    }

    inputTensor.dispose();
}

function navigateToSection(iconClass) {
    if (iconClass === 'x') {
        // if (confirm('Are you sure you want to exit?')) {
        //   window.close();
        // }
        return;
    }

    const targetSection = navigationMap[iconClass];
    if (targetSection && targetSection !== currentSection) {
        // Hide current section
        document.getElementById(currentSection).classList.add('hidden');

        // Show target section
        document.getElementById(targetSection).classList.remove('hidden');

        // Update current section
        currentSection = targetSection;

        // Removed auto-delete feature: do not clear canvas after navigation
    }
}

async function loadModel() {
    try {
        model = await tf.loadLayersModel('/static/assets/icon_classifier/tfjs-icon-classifier.json');
        document.getElementById('result').textContent = '✅ Model loaded! Draw and press Predict.';
        console.log('Model loaded.');
    } catch (err) {
        document.getElementById('result').textContent = '❌ Failed to load model';
        console.error('Error loading model:', err);
    }
}

// Help modal
document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.remove('hidden');
});

document.getElementById('close-help').addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
});

// Close modal on outside click
document.getElementById('help-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('help-modal')) {
        document.getElementById('help-modal').classList.add('hidden');
    }
});

loadModel();
});
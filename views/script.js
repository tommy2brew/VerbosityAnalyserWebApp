//hamburger menu functionality
document.getElementById("burger").addEventListener("click", function () {
    links = document.getElementById("links");
    if (links.style.display === "flex") {
        links.style.display = "none";
    }
    else {
        links.style.display = "flex";
    }
});

let loginButton = document.querySelector('#login');
if (loginButton !== null) {
    document.querySelector('#login').addEventListener("click", function () {
    window.location.href = '/login';
    });
};

//defining a function to get a random element from an array and remove it//
Array.prototype.random = function () {
    return this[Math.floor((Math.random() * this.length))];
}

let words = ["Enigma", "Supine", "Sonder", "Effulgent", "Mellifluous", "Cacophony", "Bucolic",
    "Ethereal", "Incandescent", "Labyrinthine", "Ineffable",
    "Resilience", "Mellifluous", "Serendipity", "Halcyon", "Euphoria",
    "Surreal", "Vellichor", "Nebulous", "Serenity", "Solitude", "Quintessence",
    "Aurora", "Whimsical", "Serenade", "Ephemeral", "Tranquil", "Vivacious", "Sempiternal", "Enchanting"];

const pageWidth = window.innerWidth;


const outerCircle = document.querySelector('#outer-circle').getBoundingClientRect();
const outerCircleEdge = outerCircle.left + outerCircle.width - 100;
const outerCircleBottom = outerCircle.top + outerCircle.height - 50;

function spawnWord() {
    let wordElement = document.createElement('span');
    wordElement.textContent = `"${words.random()}"`;
    wordElement.classList.add('falling-word');

    let xPosition = Math.random() * pageWidth;
    wordElement.style.left = `${xPosition}px`;

    let degrees = Math.random() * 180;
    wordElement.style.transform = `rotate(${degrees}deg)`;
    
    //randomly determining at what co-ordinates the word should fade out//
    let animationEndX = Math.floor((Math.random() * (outerCircleEdge - outerCircle.left) + outerCircle.left));
    let animationEndY = Math.floor((Math.random() * (outerCircleBottom - outerCircle.top) + outerCircle.top));
    
    setTimeout(() => {
        wordElement.style.transform = `translate(${animationEndX - xPosition}px, ${animationEndY}px)`;
        wordElement.style.opacity = '0';
    }, 100);

    wordElement.addEventListener('transitionend', () => {
        wordElement.remove();
    });
    document.body.appendChild(wordElement);
}

let wordInterval = setInterval(spawnWord, 500);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};
async function fillCircle(score) {
    let circle = document.querySelector('#outer-circle');
    let text = circle.querySelector('p');
    let fillScore = score/10;
    let filled = 0;

    //delay effect by 2s to give illusion of falling words filling tank//
    await delay(2000);
    while(filled < fillScore){
        circle.style.background = `linear-gradient(to top, #1DB954 ${filled}%, white 0%)`;
        scoreJump = Math.random() * (score/750- score/3000) + score/3000;
        filled += scoreJump;
        text.textContent = Math.trunc(filled*10);
        interval = Math.random() * (150 - 40) + 40;
        await delay(interval);
    }
    text.textContent = score;
    clearInterval(wordInterval);
}

fillCircle(800);
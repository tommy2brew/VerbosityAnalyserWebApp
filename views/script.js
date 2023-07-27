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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};
async function fillCircle(score) {
    let wordInterval = setInterval(spawnWord, 500);
    
    let circle = document.querySelector('#outer-circle');
    let text = circle.querySelector('p');
    let fillScore = score/10;
    let filled = 0;

    //delay effect by 2s to give illusion of falling words filling tank//
    await delay(2000);
    while(filled < fillScore){
        circle.style.background = `linear-gradient(to top, #1DB954 ${filled}%, white 0%)`;
        let scoreJump = Math.random() * (score/750- score/3000) + score/3000;
        filled += scoreJump;
        text.textContent = Math.trunc(filled*10);
        let interval = Math.random() * (150 - 40) + 40;
        await delay(interval);
    }
    text.textContent = score;
    clearInterval(wordInterval);

    document.querySelector('#score').textContent = score;
    document.querySelector('#percentile').textContent = "90%";
};

function setWordiest(wordinessItems) {

    function updateListElements(listElements, itemList) {
        listElements.forEach((li, index) => {
            let picture = itemList[index].picture;
            let name = itemList[index].name;
            let wordiness = itemList[index].wordiness;
            
            
            let img = document.createElement("img");
            img.src = picture;
            li.appendChild(img);
            let span = document.createElement("span");
            span.textContent = `${index+1}. ${name}- ${wordiness} unique words per minute`;
            li.appendChild(span)
            
        })
    }

    let topTracksElements = document.querySelectorAll('#tracks li');
    let tracks = wordinessItems.tracks;
    updateListElements(topTracksElements, tracks);

    let topArtistsElements = document.querySelectorAll('#artists li');
    let artists = wordinessItems.artists;
    updateListElements(topArtistsElements, artists);
}

async function getWordinessItems() {
    try{
        const response = await fetch('/points');
        const data = await response.json();
        return data;
    }
    catch(error) {
        console.error("Error when fetching wordiness data: " + error);
    }
}

async function personalisePage() {
    try {
        let wordinessItems = await getWordinessItems();
        setWordiest(wordinessItems);
        await fillCircle(wordinessItems.wordiness);

        document.querySelector('.results-container').classList.add('slide-in');
        await delay(1500)
        document.querySelector('.personal-container').classList.add('slide-in');
    }
    catch (error) {
        console.error("Error when getting wordiness items: " + error);
        wordinessFailed();
    }
}

function wordinessFailed() {

}

personalisePage();
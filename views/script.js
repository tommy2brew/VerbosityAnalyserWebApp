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
if(loginButton){
    loginButton.addEventListener("click", function () {
        window.location.href = '/login';
    });
}


let logoutButton = document.querySelector('#logout');
if(logoutButton){
    logoutButton.addEventListener("click", function () {
        window.location.href = '/logout';
    });
}


//defining a function to get a random element from an array and remove it//
Array.prototype.random = function () {
    return this[Math.floor((Math.random() * this.length))];
}

let words = ["Enigma", "Supine", "Sonder", "Effulgent", "Mellifluous", "Cacophony", "Bucolic",
    "Ethereal", "Incandescent", "Labyrinthine", "Ineffable",
    "Resilience", "Mellifluous", "Serendipity", "Halcyon", "Euphoria",
    "Surreal", "Vellichor", "Nebulous", "Serenity", "Solitude", "Quintessence",
    "Aurora", "Whimsical", "Serenade", "Ephemeral", "Tranquil", "Vivacious", "Sempiternal", "Enchanting"];

function spawnWord() {
    const pageWidth = window.innerWidth;
    const circle = document.querySelector('#outer-circle').getBoundingClientRect();
    const circleEdge = circle.left + circle.width - 100;
    const circleBottom = circle.top + circle.height - 50;

    let wordElement = document.createElement('span');
    wordElement.textContent = `"${words.random()}"`;
    wordElement.classList.add('falling-word');

    let xPosition = Math.random() * pageWidth;
    wordElement.style.left = `${xPosition}px`;

    let degrees = Math.random() * 180;
    wordElement.style.transform = `rotate(${degrees}deg)`;
    
    //randomly determining at what co-ordinates the word should fade out//
    let animationEndX = Math.floor((Math.random() * (circleEdge - circle.left) + circle.left));
    let animationEndY = Math.floor((Math.random() * (circleBottom - circle.top) + circle.top));
    
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
};

function setWordiest(wordinessItems) {

    function updateListElements(listElements, itemList) {
        listElements.forEach((li, index) => {
            let picture = itemList[index].picture;
            let name = itemList[index].name;
            let wordiness = itemList[index].wordiness;
            
            let img = li.querySelector("img");
            img.src = picture;
            let span = li.querySelector("span");
            span.textContent = `${index+1}. ${name}- ${wordiness} unique wpm`;
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
        if(data.status !== 401){
            return data;
            
        }
        document.querySelector('.notFound').classList.add('slide-in');
    }
    catch(error) {
        console.error("Error when fetching wordiness data: " + error);
        document.querySelector('.notFound').classList.add('slide-in');
    }
}

async function personalisePage() {
    try {
        let wordinessItems = await getWordinessItems();

        document.querySelector('#warning').style.display = "none";
        document.querySelector('.calculating').style.display = "none";
        
        setWordiest(wordinessItems);
        await fillCircle(wordinessItems.wordiness);

        document.querySelector('.results-container').classList.add('slide-in');
        await delay(1500)
        document.querySelector('.personal-container').classList.add('slide-in');
    }
    catch (error) {
        console.error("Error when getting wordiness items: " + error);
        document.querySelector('.notFound').classList.add('slide-in');
    }
}

window.onload = () => {
    if(window.location.pathname === "/score"){
        personalisePage();
    }
}
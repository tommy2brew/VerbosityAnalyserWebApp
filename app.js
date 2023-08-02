const express = require("express");
const session = require('express-session');
const querystring = require("querystring");
const http = require('http');
const https = require('https');
const { error } = require("console");
const { resolve } = require("path");
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3001;

app.use(express.static('views'));
app.use(express.static('images'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

//handling routes//
app.get('/', (req, res) => {
    res.sendFile('wordify.html', { root: './views' });
});

app.get('/about', (req, res) => {
    res.sendFile('about.html', { root: './views' })
});

app.get('/privacy', (req, res) => {
    res.sendFile('privacy.html', { root: './views' })
});

app.get('/score', function (req, res) {
    if (!req.session.accessToken) {
      res.redirect('/login');
      return;
    }
    res.sendFile('score.html', { root: './views' });
});

app.get('/logout', function (req,res) {
    req.session.accessToken = "";
    req.session.refreshToken = "";
    req.session.results = "";
    req.session.loggedOut = "true";
    res.redirect('/');
});

///////////////////////API AUTHENTICATION////////////////////////////

//constants used in multiple routes//
const secret = process.env.SECRET;
const clientID = "8a80fb4569e4406da3ad13870a043324";
const redirectURI = "http://localhost:3001/callback";
//const redirectURI = "http://192.168.43.117:3001/callback";
//const redirectURI = 'https://wordify-c0z5.onrender.com/callback';
const authorisation = 'Basic ' + Buffer.from(clientID + ':' + secret).toString('base64');
const contentType = 'application/x-www-form-urlencoded';

//sending user to spotify login//
app.get('/login', function (req, res) {
    let state = (Math.random() * 10).toString(36);
    let authURL = "https://accounts.spotify.com/authorize?";
    res.redirect(authURL +
        querystring.stringify({
            client_id: clientID,
            response_type: "code",
            redirect_uri: redirectURI,
            scope: "user-top-read",
            show_dialog: req.session.loggedOut,
            state: state
        }));
});

//gettting api tokens after user authenticates and sending user to score page//
app.get('/callback', function (req, res) {
    let authCode = req.query.code;
    let state = req.query.state;

    if (req.query.error || state === null) {
        res.sendFile('wordify.html', { root: './views' });
        console.log(req.query.error);
        return;
    };

    let options = {
        method: 'POST',
        hostname: 'accounts.spotify.com',
        path: '/api/token',
        headers: {
            'Authorization': authorisation,
            'Content-Type': contentType
        }
    };

    let postBody = querystring.stringify({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectURI
    });

    let post = https.request(options, (outcome) => {
        let response = '';

        outcome.on('data', (chunk) => {
            response += chunk;
        });

        outcome.on('end', () => {
            if (outcome.statusCode === 200) {
                response = JSON.parse(response);
                req.session.accessToken = response.access_token;
                req.session.refreshToken = response.refresh_token;
                req.session.loggedOut = "false";
                res.redirect('/score');
            }
            else {
                console.log(outcome.statusCode);
            };
        });
    });
    post.on('error', (error) => {
        console.error("Error in spotify callback. Error is: " + error);
    });
    post.write(postBody);
    post.end();
});

//refreshing the access token when it expires// 
app.get('/refresh_token', function(req, res){
    let refresh_token = req.query.refresh_token;
    let options = {
        method: 'POST',
        hostname: 'accounts.spotify.com',
        path: '/api/token',
        headers: {
            'Authorization' : authorisation,
            'Content-Type' : contentType
        }
    };

    let postBody = querystring.stringify({
        grant_type : 'refresh_token',
        refresh_token : refresh_token
    });

    let post = https.request(options, (outcome) =>{
        let response = '';

        outcome.on('data', (chunk) =>{
            response += chunk;
        });

        outcome.on('end', () => {
            if(outcome.statusCode === 200) {
                response = JSON.parse(response);
                req.session.accessToken = response.access_token;
            };
        });
    })

    post.on('error', (error) => {
        console.error("Error in refreshing spotify token. Error is: " + error)
    });
    post.write(postBody);
    post.end();
});


/////////////////////API CALLS USING ACCESS TOKEN/////////////////////////////
function getData(endPoint, queryParams, accessToken) {
    return new Promise((resolve, reject) => {
        let options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };
        let request = https.request(`${endPoint}?${queryParams.toString()}`,
            options, (outcome) => {
            let data = '';
        
            outcome.on('data', (chunk) => {
                data+=chunk;
            });
        
            outcome.on('end', () => {
                if(outcome.statusCode === 200) {
                    data = JSON.parse(data);
                    resolve(data);
                }
                else{
                    console.log(JSON.parse(data));
                    reject(console.log(outcome.statusCode + "in get spotify data"));
                };
            });
        });
        request.on('error', (error) => {
            console.error("Error in getting spotify data. Error is: " + error)
        });
        request.end();
    });
};

let userTracks;
let userArtists;

async function setTopTracks(accessToken){
    let endPointTopTracks = 'https://api.spotify.com/v1/me/top/tracks';
    let queryParamsTopTracks = new URLSearchParams({
        limit: 30,
        offset: 0
    });
    try{
        let tracksJSON = await getData(endPointTopTracks, queryParamsTopTracks, accessToken);
        userTracks = tracksJSON.items;
    }
    catch(error) {
        console.error("Error when setting the top user tracks. Error is: " + error)
    }
}

async function setTopArtists(accessToken){
    let endPointTopArtists = 'https://api.spotify.com/v1/me/top/artists';
    let queryParamsTopArtists = new URLSearchParams({
        limit: 15,
        offset: 0
    });
    try {
        let artistsJSON = await getData(endPointTopArtists, queryParamsTopArtists, accessToken);
        userArtists = artistsJSON.items;
    }
    catch (error){
        console.error("Error when setting the top user artists. Error is: " + error)
    }
}

async function getArtistTopTracks(id, accessToken){
    let endPointArtistTop = `https://api.spotify.com/v1/artists/${id}/top-tracks`;
    let queryParamsArtistTop = new URLSearchParams({
        market: 'GB'
    })
    try {
        let topTracksJSON = await getData(endPointArtistTop, queryParamsArtistTop, accessToken);
        return topTracksJSON.tracks;
    }
    catch(error) {
        console.error("Error when setting the artist top tracks. Error is: " + error)
    }
}

async function getUsername(accessToken) {
    let endPointUsername = 'https://api.spotify.com/v1/me';
    try {
        let userData = await getData(endPointUsername, "", accessToken);
        return userData.display_name;
    }
    catch(error){
        console.error("Error when getting username. Error is: " + error);
    }
}
////////////////////////SONG LYRIC API CALL///////////////////////////////
const musixmatchKey = process.env.LYRICS_KEY;
function getLyricsData(endpoint, queryParams) {
    return new Promise((resolve, reject) => {
        let options = {
            method: 'GET'
        };
        let request = http.request(`${endpoint}?${queryParams}&apikey=${musixmatchKey}`
            , options, (outcome) => {
            let data = '';
        
            outcome.on('data', (chunk) => {
                data+=chunk;
            });
        
            outcome.on('end', () => {
                data = JSON.parse(data);
                let statusCode = data.message.header.status_code; //data.message.header.status_code;
                if(statusCode === 200) {
                    resolve(data);
                }
                else if (statusCode === 401){
                    reject(new Error("401 error when fetching data for: "));
                }
                else{
                    reject(new Error(`${outcome.statusCode} + error when fetching data for: `));
                };
            });
        });
        request.on('error', (error) => {
            console.error("Error when getting the lyrics data. Error is: " + error)
        });
        request.end();
    });
}

async function getLyricsID(urlSearch) {
    try{
        let endPointLyricsID = "http://api.musixmatch.com/ws/1.1/track.search";
        let queryLyricsID = `&q_artist=${urlSearch[0]}&q_track=${urlSearch[1]}&f_has_lyrics=1&track_filter=desc`
        let lyricsIDJson = await getLyricsData(endPointLyricsID, queryLyricsID);
        return lyricsIDJson.message.body.track_list[0].track.track_id;
    }
    catch (error) {
        console.error(`problem finding lyric id for ${urlSearch[1]}. Error is: ${error}`);
        if(error.toString().includes('401')) {throw ("401");}
    }
}

async function getLyrics(id) {
    try {
        let endPointLyrics = "http://api.musixmatch.com/ws/1.1/track.lyrics.get";
        let queryLyrics = `track_id=${id}`
        let lyricsJSON = await getLyricsData(endPointLyrics, queryLyrics);
        return lyricsJSON.message.body.lyrics.lyrics_body;
    }
    catch (error) {
        console.error(`problem finding lyric body for ${id}. Error is: ${error}`);
        if(error.toString().includes('401')) {throw ("401");}
    }
}
//////////////////////WORDINESS SCORE LOGIC////////////////////////////

let top5Tracks = [];
let top5Artists = [];

//blueprint for both top songs and artists, to be used in client-side script//
class wordinessItem {
    constructor(name, picture, wordiness) {
        this.name = name;
        this.picture = picture;
        this.wordiness = wordiness;
    }
}

//converting a trackname and artist name into a useful form for musixMatch api//
function musixmatchURLify(track, artist) {;
    let trackNameURLFormatted = track;

    if(trackNameURLFormatted.includes('Remastered')){
        //check if its in format "(Remastered)"" or "- Remastered"
        let remasterOffset = track.includes('(Remaster')? 2 : 3
        trackNameURLFormatted = trackNameURLFormatted.substring
            (0, trackNameURLFormatted.indexOf('Remaster')-remasterOffset);
    };

    trackNameURLFormatted  = trackNameURLFormatted.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase();
    let artistNameURLFormatted = artist.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase();
    return [encodeURI(artistNameURLFormatted), encodeURI(trackNameURLFormatted)];
}

function distinct(value, index, array) {
    return array.indexOf(value) === index;
}
async function getTrackWordiness(urlSearch, duration) {
    let id = await getLyricsID(urlSearch);
    if(!id){
        return -1;
    }
    let lyrics = await getLyrics(id);
    if(!lyrics || lyrics.length === 0){
        return -1;
    }
    
    lyrics = lyrics.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\n/g, " ");
    lyrics = lyrics.split(' ').slice(0,lyrics.length-7);
    uniqueWords = lyrics.filter(distinct).length;

    durationMins = duration/60000;    
    wordiness = uniqueWords / (durationMins*0.3);
    return Math.round(wordiness);
}

async function getArtistTopTrackNamesAndID(id, accessToken) {
    let topTrackNamesAndDuration = [];

    let topTracksArray = await getArtistTopTracks(id, accessToken);
    topTracksArray.forEach(track => {
        topTrackNamesAndDuration.push({name: track.name, duration: track.duration_ms})
    })
    return topTrackNamesAndDuration;
}

async function calculateArtistWordiness(id, name, accessToken) {
    let totalTracksWordiness = 0;
    let trackOmissions = 0;

    let allArtistTracks = await getArtistTopTrackNamesAndID(id, accessToken);
    for(const track of allArtistTracks){
        trackWordiness = await getTrackWordiness(musixmatchURLify(track.name, name),
            track.duration);
        if(trackWordiness === -1){
            trackOmissions ++;
        }
        else{
            totalTracksWordiness += trackWordiness;
        }
    }
    if(trackOmissions > allArtistTracks.length*0.3){return 0};

    let usableTracks = allArtistTracks.length-trackOmissions;
    try{
        return Math.round(totalTracksWordiness/usableTracks);
    }
    catch (error){
        console.log(`Couldn't get wordiness for ${name}. They might have no lyrics on file`);
    }
    
}

async function setWordiestTracks() {
    let allTracks = [];

    for (const track of userTracks) {
        let name = track.name;
        let artist = track.artists[0].name;
        let albumCover = track.album.images[1].url;
        let duration = track.duration_ms;
        let wordiness = await getTrackWordiness(musixmatchURLify(name, artist), duration);
        trimmedTrack = new wordinessItem(name, albumCover, wordiness);
        allTracks.push(trimmedTrack);
    }

    allTracks.sort((a,b) => b.wordiness - a.wordiness);
    let wordiestTracks = allTracks.slice(0,5);
    top5Tracks = wordiestTracks;
}

async function setWordiestArtists(accessToken) {
        let allArtists = [];

        for (const artist of userArtists) {
            let name = artist.name;
            let picture = artist.images[1].url;
            let wordiness = await calculateArtistWordiness(artist.id, name, accessToken)
            trimmedArtist = new wordinessItem(name, picture, wordiness);
            allArtists.push(trimmedArtist);
        }

        allArtists.sort((a,b) => b.wordiness - a.wordiness);
        let wordiestArtists = allArtists.slice(0,5);
        top5Artists = wordiestArtists;
}

async function calculateUserWordiness() {
    let allWordinesses = [];
    let trackOmissions = 0;

    let scoreOffset = 1.25;
    for (const track of userTracks) {
        let artist = track.album.artists[0].name;
        let name = track.name;
        let duration = track.duration_ms; 

        musixmatchURL = musixmatchURLify(name, artist);
        let wordiness = await getTrackWordiness(musixmatchURL, duration);
        if(wordiness === -1){
            trackOmissions ++;
        }
        else{
            allWordinesses.push(wordiness * scoreOffset);
        }
        scoreOffset -= 0.025;
    }
    
    allWordinesses.sort((a,b) => b - a);
    sliceRange = trackOmissions < 15 ? 15 : trackOmissions;
    let top15wordiest = allWordinesses.slice(0, sliceRange);
    let totalWordiness = top15wordiest.reduce((accumulator, currentValue) => accumulator + currentValue, 0);

    const score = (totalWordiness*10) / top15wordiest.length;
    return Math.round(score);
}

const db = new sqlite3.Database('production.db')
async function insertScore(score, name) {
    db.run('INSERT INTO scores VALUES(?, ?, ?)', [null, name, score], (error) => {
        if(error){
            console.error("Problem inserting score. Error is: " + error);
        }
    });
}

function retrieveTopScores() {
    return new Promise((resolve, reject) => {
        db.all('SELECT name, score FROM scores ORDER BY score DESC LIMIT 5', (error, rows) => {
            if(error){
                reject(new Error("Problem getting top scores. Error is: " + error));
            }
            else{
                resolve(rows);
            }
        });
    });
}

function getPosition(score) {
    return new Promise((resolve, reject) => {
        db.all('SELECT name, score FROM scores ORDER BY score DESC', (error, rows) => {
            if(error){
                reject(new Error("Problem getting top scores. Error is: " + error));
            }
            else{
                let index = rows.findIndex((row) => row.score <= score);
                resolve(index + 1);
            }
        })
    })
}

function assignCategory(score) {
    let category = {
        title: "",
        image: "",
        description: ""
    };
    if(score < 100){
        category.title = "Monk";
        category.image = "/images/monk.jpg";
        category.description = "A score below 100 means you've got some monk-like listening habits. Your songs have almost no lyrics, you probably listen to classical music or nature sounds while in deep meditation for several hours a day. Or you're the complete opposite and are into EDM.";
    }
    else if(score < 200){
        category.title = "Dreamer";
        category.image = "/images/dreamer.jpg";
        category.description = "A score of 100-199 makes you a dreamer. You songs are probably very conceptual, with lyrics scattered infrequently through them. You might be really into prog rock or a similar genre.";
    }
    else if(score < 300){
        category.title = "Instrumentalist";
        category.image = "/images/instrumentalist.jpg";
        category.description = "Scoring between 200-299 means you really like your instruments. Your might be into pop or dance or rock and likely don't listen to music for the lyrics.";
    }
    else if(score < 400){
        category.title = "Music Listener";
        category.image = "/images/average.jpg";
        category.description = "You sure like music alright. A score in the 300s means you like music with lyrics, you like music with no lyrics, you like music. Pretty average.";
    }
    else if(score < 500){
        category.title = "Grounded";
        category.image = "/images/grounded.jpeg";
        category.description = "A score in the 400s makes you a pretty grounded listener who likes music with lyrical and intrumental components; lyrical complexity isn't something you seek out or avoid.";
    }
    else if(score < 600){
        category.title = "Witty";
        category.image = "/images/witty.jpeg";
        category.description = "Scoring in the 500s means your songs have some lyrical themes and contain a fair amount of unique lyrics. You might listen to a bit of rap or metal might be your thing.";
    }
    else if(score < 700){
        category.title = "Bookworm";
        category.image = "/images/bookworm.jpg";
        category.description = "Congrats, you've got some smart lyrics. Scoring in the 600s means your artists put some real thought into their lines. You've probably got a few rappers in your repertoire, but maybe aren't one for seeking out too many concious themes.";
    }
    else if(score < 800){
        category.title = "Wordsmith";
        category.image = "/images/wordsmith.jpg";
        category.description = "Wow look at you go. A 700s score means you listen to some verbose songs and like to be bombarded by lyrics ocassionally. Your artists know how to spit some fire when it's called for.";
    }
    else if(score < 900){
        category.title = "Scholar";
        category.image = "/images/scholar.jpg";
        category.description = "Dayom. You listen to some of the most loquacious artists in the game. A score in the 800s means you appreciate an artist ability to craft lyrics which haven't been thought up before. You likely enjoy exploring some complex themes in your music!";
    }
    else{
        category.title = "Supa Hot Fire!!!";
        category.image = "images/supahot.jpg";
        category.description = "Supa Hot Fireee!! You know all the words and seek out only artists who can dish out the toughest, most complex bars. Your artists have obviously all studied under the tutiledge of Sr. Supa Hot Fire.";
    }
    return category;
}

//////////////////////ROUTE USED IN CLIENT-SIDE TO SCORE USER/////////////////////////// 
app.get('/leaderboard', async function(req, res) {
    try{
        let leaderboard = await retrieveTopScores();
        res.send(leaderboard);
    }
    catch{
        console.error("Couldn't get leaderboard. Error is " + error);
    }
})

app.get('/points', async function (req, res) {
    try{
        if(req.session.results){
            res.send(req.session.results);
            return;
        }

        let accessToken = req.session.accessToken;
        await setTopArtists(accessToken);
        await setWordiestArtists(accessToken);
        console.log(top5Artists);
        console.log("------------------------artists---------------------------------");
        await setTopTracks(accessToken);
        await setWordiestTracks();
        console.log(top5Tracks);
        console.log("------------------------top tracks---------------------------------");

        let userWordiness = await calculateUserWordiness();
        console.log(userWordiness);
        console.log("------------------------wordiness---------------------------------");

        let username = await getUsername(accessToken);
        await insertScore(userWordiness, username);
        let leaderboardPosition = await getPosition(userWordiness);
        let leaderboardRow = {
            position: leaderboardPosition,
            name: username,
            score: userWordiness
        };

        let userCategory = assignCategory(userWordiness);
        let results = {
            status: 200,
            tracks: top5Tracks,
            artists: top5Artists,
            wordiness: userWordiness,
            category: userCategory,
            leaderboardRow: leaderboardRow
        };

        req.session.results = results;
        res.send(results);
        
        /*let testTrack1 = new wordinessItem("Flowers In Your Hair", "https://i.scdn.co/image/ab67616d0000485115784f5212050cf2e67f1935", 97);
        let testTrack2 = new wordinessItem("Dead Sea", "https://i.scdn.co/image/ab67616d0000485115784f5212050cf2e67f1935", 70);
        let testTrack3 = new wordinessItem( "Flapper Girl", "https://i.scdn.co/image/ab67616d0000485115784f5212050cf2e67f1935", 69);
        let testTrack4 = new wordinessItem("Elouise", "https://i.scdn.co/image/ab67616d0000485115784f5212050cf2e67f1935", 65);
        let testTrack5 = new wordinessItem("Classy Girl", "https://i.scdn.co/image/ab67616d0000485115784f5212050cf2e67f1935", 65);
        let testTracks = [testTrack1, testTrack2, testTrack3, testTrack4, testTrack5];

        let testArtist1 = new wordinessItem("Hozier", "https://i.scdn.co/image/ab6761610000f178ad85a585103dfc2f3439119a", 71);
        let testArtist2 = new wordinessItem("Johnny Cash", "https://i.scdn.co/image/ab6761610000f1785921cb8f2ec7bf6b5e725bcc", 66);
        let testArtist3 = new wordinessItem("James Taylor", "https://i.scdn.co/image/ab6761610000f1785921cb8f2ec7bf6b5e725bcc", 66)
        let testArtist4 = new wordinessItem("The Lumineers", "https://i.scdn.co/image/ab6761610000f178c79f78fd72a3e5faf699a8be", 64);
        let testArtist5 = new wordinessItem( "The Avett Brothers", "https://i.scdn.co/image/ab6761610000f17890107bc970aad5a8b2a6dc40", 62);
        let testArtists = [testArtist1, testArtist2, testArtist3, testArtist4, testArtist5];

        let testWordiness = 475;

        let testCategory = assignCategory(testWordiness);
        let testUsername = "Joe";
        await insertScore(testWordiness, testUsername);
        let testLeaderboardPosition = await getPosition(testWordiness);
        let testLeaderboardRow = {
            position: testLeaderboardPosition,
            name: testUsername,
            score: testWordiness
        };
    
        let test = {
            status: 200,
            tracks: testTracks,
            artists: testArtists,
            wordiness: testWordiness,
            category: testCategory,
            leaderboardRow: testLeaderboardRow
        };
        res.send(test);*/
    }
    catch (error){
        console.error("Couldnt calculate score: " + error);
        res.send({status: 401});
    }
});

//starting the express
app.listen(port, () => {
    console.log("Hello I have started");
});
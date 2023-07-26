const express = require("express");
const session = require('express-session')
const querystring = require("querystring");
const https = require('https');
const path = require('path');
const { error } = require("console");
require('dotenv').config();
const app = express();
const port = 3001;

app.use(express.static('views'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
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

///////////////////////API AUTHENTICATION////////////////////////////

//constants used in multiple routes//
const secret = process.env.SECRET;
const clientID = "8a80fb4569e4406da3ad13870a043324";
const redirectURI = 'http://localhost:3001/callback';
const authorisation = 'Basic ' + Buffer.from(clientID + ':' + secret).toString('base64');
const contentType = 'application/x-www-form-urlencoded';

//sending user to spotify login//
app.get('/login', function (req, res) {
    var authURL = "https://accounts.spotify.com/authorize?";
    res.redirect(authURL +
        querystring.stringify({
            client_id: clientID,
            response_type: "code",
            redirect_uri: redirectURI,
            scope: "user-top-read",
            show_dialog: "true"
        }));
});

//gettting api tokens after user authenticates and sending user to score page//
let errorList = [];

app.get('/callback', function (req, res) {
    console.log("callbacked");
    if (req.query.error) {
        res.sendFile('wordify.html', { root: './views' });
        console.log(req.query.error);
        return;
    };
    let authCode = req.query.code;

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
                session.accessToken = response.access_token;
                req.session.refreshToken = response.refresh_token;
                session.refreshToken = response.access_token;
                res.redirect('/score');
            }
            else {
                console.log(outcome.statusCode);
            };
        });
    });
    post.on('error', (error) => {
        errorList.push(error);
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
                session.accessToken = response.access_token;
            };
        });
    })

    post.on('error', (error) => {
        errorList.push(error);
    });
    post.write(postBody);
    post.end();
});


/////////////////////API CALLS USING ACCESS TOKEN/////////////////////////////
function getData(endPoint, queryParams) {
    return new Promise((resolve, reject) => {
        let options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`
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
                    reject(console.log(outcome.statusCode + "in get sportify data"));
                };
            });
        });
        request.on('error', (error) => {
            errorList.push(error);
        });
        request.end();
    });
};

let userTracks;
let userArtists;

async function setTopTracks(){
    let endPointTopTracks = 'https://api.spotify.com/v1/me/top/tracks';
    let queryParamsTopTracks = new URLSearchParams({
        limit: 30,
        offset: 0
    });
    try{
        let tracksJSON = await getData(endPointTopTracks, queryParamsTopTracks);
        userTracks = tracksJSON.items;
    }
    catch(error) {
        errorList.push(error);
    }
}

async function setTopArtists(){
    let endPointTopArtists = 'https://api.spotify.com/v1/me/top/artists';
    let queryParamsTopArtists = new URLSearchParams({
        limit: 20,
        offset: 0
    });
    try {
        let artistsJSON = await getData(endPointTopArtists, queryParamsTopArtists);
        userArtists = artistsJSON.items;
    }
    catch {
        errorList.push(error);
    }
}

async function getArtistTopTracks(id){
    let endPointArtistTop = `https://api.spotify.com/v1/artists/${id}/top-tracks`;
    let queryParamsArtistTop = new URLSearchParams ({
        market: 'GB'
    });
    try {
        let topTracksJSON = await getData(endPointArtistTop, queryParamsArtistTop);
        return topTracksJSON.tracks;
    }
    catch(error) {
        errorList.push(error);
    }
}

////////////////////////SONG LYRIC API CALL///////////////////////////////
const musixmatchKey = process.env.LYRICS_KEY;
function getLyricsIDJSON(queryParams) {
    return new Promise((resolve, reject) => {
        let options = {
            method: 'GET',
        };
        let endPoint = "https://api.musixmatch.com/ws/1.1/track.search";
        let request = https.request(`${endPoint}?apikey=${musixmatchKey}&
            q_track=${queryParams[0]}&q_artist=${queryParams[1]}
                &f_has_lyrics=1&$track_filter=desc`
            , options, (outcome) => {
            let data = '';
        
            outcome.on('data', (chunk) => {
                data+=chunk;
            });
        
            outcome.on('end', () => {
                data = JSON.parse(data);
                let statusCode = outcome.statusCode; //data.message.header.status_code; 
                if(statusCode === 200) {
                    resolve(data);
                }
                else if (statusCode === 401){
                    reject(new Error("Maxed API requests, try again tommorow"));
                }
                else{
                    reject(new Error(`${outcome.statusCode} + in lyrics ID`));
                };
            });
        });
        request.on('error', (error) => {
            errorList.push(error);
        });
        request.end();
    });

}

function getLyricsJSON(id) {
    return new Promise((resolve, reject) => {
        let options = {
            method: 'GET',
        };
        let endPoint = "https://api.musixmatch.com/ws/1.1/track.lyrics.get";
        let request = https.request(`${endPoint}?apikey=${musixmatchKey}&track_id=${id}`
            , options, (outcome) => {
            let data = '';
        
            outcome.on('data', (chunk) => {
                data+=chunk;
            });
        
            outcome.on('end', () => {
                data = JSON.parse(data);
                //let statusCode = data.message.header.status_code; 
                let statusCode = outcome.statusCode;
                if(statusCode === 200) {
                    resolve(data);
                }
                else if (statusCode === 401){
                    reject(new Error("Maxed API requests, try again tommorow"));
                }
                else{
                    reject(new Error(`${outcome.statusCode} + in lyrics`));
                };
            });
        });
        request.on('error', (error) => {
            errorList.push(error);
        });
        request.end();
    });
}

async function getLyricsID(urlSearch) {
    try{
        let lyricsIDJson = await getLyricsIDJSON(urlSearch);
        return lyricsIDJson.message.body.track_list[0].track.track_id;
    }
    catch (error) {
        errorList.push(error);
    }
}

async function getLyrics(id) {
    try {
        let lyricsJSON = await getLyricsJSON(id);
        return lyricsJSON.message.body.lyrics.lyrics_body;
    }
    catch (error) {
        console.log(error);
        errorList.push(error);
    }
}
//////////////////////WORDINESS SCORE LOGIC////////////////////////////

let top5Tracks = [];
let top5Artists = [];

//blueprint for both top songs and artists, to be used in html elements//
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
    return [encodeURI(trackNameURLFormatted), encodeURI(artistNameURLFormatted)];
}

async function getArtistTopTrackNamesAndID(id) {
    let topTrackNamesAndDuration = [];

    let topTracksArray = await getArtistTopTracks(id);
    topTracksArray.forEach(track => {
        topTrackNamesAndDuration.push({name: track.name, duration: track.duration_ms})
    })
    return topTrackNamesAndDuration;
}

function distinct(value, index, array) {
    return array.indexOf(value) === index;
}
async function getTrackWordiness(urlSearch, duration) {
    let id = await getLyricsID(urlSearch);
    if(!id){
        console.log(urlSearch);
        return 0;
    }
    let lyrics = await getLyrics(id);
    if(!lyrics || lyrics.length === 0){
        console.log(urlSearch);
        return 0;
    }
    
    lyrics = lyrics.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\n/g, " ");
    lyrics = lyrics.split(' ');
    uniqueWords = lyrics.filter(distinct).length;

    durationMins = duration/60000;    
    wordiness = uniqueWords / (durationMins*0.3);
    return wordiness;
}

async function calculateArtistWordiness(id, name) {
    let totalTracksWordiness = 0;

    let allArtistTracks = await getArtistTopTrackNamesAndID(id);
    for(const track of allArtistTracks){
        totalTracksWordiness += await getTrackWordiness(musixmatchURLify(track.name, name),
            track.duration);
    }
    return totalTracksWordiness/allArtistTracks.length;
}

async function setWordiestTracks() {
    let allTracks = [];

    for (const track of userTracks) {
        let name = track.name;
        let artist = track.artists[0].name;
        let albumCover = track.album.images[2].url;
        let duration = track.duration_ms;
        let wordiness = await getTrackWordiness(musixmatchURLify(name, artist), duration);
        trimmedTrack = new wordinessItem(name, albumCover, wordiness);
        allTracks.push(trimmedTrack);
    }

    allTracks.sort((a,b) => b.wordiness - a.wordiness);
    let wordiestTracks = allTracks.slice(0,5);
    top5Tracks = wordiestTracks;
}

async function setWordiestArtists() {
    
        let allArtists = [];

        for (const artist of userArtists) {
            let name = artist.name;
            let picture = artist.images[2].url;
            let wordiness = await calculateArtistWordiness(artist.id, name)
            trimmedArtist = new wordinessItem(name, picture, wordiness);
            allArtists.push(trimmedArtist); 
        }

        allArtists.sort((a,b) => b.wordiness - a.wordiness);
        let wordiestArtists = allArtists.slice(0,5);
        top5Artists = wordiestArtists;
    
    
}

async function calculateUserWordiness() {
    let totalWordiness = 0;
    
    for (const track of userTracks) {
        let artist = track.album.artists[0].name;
        let name = track.name;
        let duration = track.duration_ms; 

        musixmatchURL = musixmatchURLify(name, artist);
        let wordiness = await getTrackWordiness(musixmatchURL, duration);
        totalWordiness += wordiness;
    }
    return totalWordiness/3;
}


app.get('/points', async function (req, res) {
    //await setTopTracks();
    await setTopArtists();
    await setTopTracks();
    await setWordiestArtists();
    console.log(top5Artists);
    console.log("------------------------artists---------------------------------");
    await setWordiestTracks();
    console.log(top5Tracks);
    console.log("------------------------top tracks---------------------------------");
    wordiness = await calculateUserWordiness();
    console.log(wordiness);
    console.log(errorList);
    //await setWordiestTracks();
    //let wordiness = await calculateUserWordiness();
    
    //console.log("------------------------tracks---------------------------------");
    //console.log(wordiness + "wordiness score!");
    
});

//process.on('unhandledRejection', (reason, promise) => {
 //   console.error('Unhandled Rejection at:', promise, 'reason:', reason);
 // });  

//starting the server
app.listen(port, () => {
    console.log("Hello I have started");
});
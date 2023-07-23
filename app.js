const express = require("express");
const session = require('express-session')
const querystring = require("querystring");
const axios = require('axios');
const https = require('https');
const path = require('path');
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
            show_dialog: "false"
        }));
});

//gettting api tokens after user authenticates and sending user to score page//
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
        console.error(error);
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
        console.error(error);
    });
    post.write(postBody);
    post.end();
});


/////////////////////API CALLS USING ACCESS TOKEN/////////////////////////////

function getData(endPoint, queryYN, queryParams) {
    return new Promise((resolve, reject) => {
        let options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`
            }
        };
        possibleQuery = (queryYN === "Y")? "?": "";
        let request = https.request(`${endPoint}${possibleQuery}${queryParams.toString()}`, options, (outcome) => {
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
                    reject(new error(`${outcome.statusCode} + in get data`));
                };
            });
        });
        request.on('error', (error) => {
            console.log(error);
        });
        request.end();
    });
};

let userTracks;
let userArtists;

async function getTopTracks(){
    let endPointTopTracks = 'https://api.spotify.com/v1/me/top/tracks';
    let queryParamsTopTracks = new URLSearchParams({
        limit: 30,
        offset: 0
    });
    let tracks = await getData(endPointTopTracks, "Y", queryParamsTopTracks);
    userTracks = tracks.items;
    return tracks.items;
}

async function getTopArtists(){
    let endPointTopArtists = 'https://api.spotify.com/v1/me/top/artists';
    let queryParamsTopArtists = new URLSearchParams({
        limit: 30,
        offset: 0
    });
    let artists = await getData(endPointTopArtists, "Y", queryParamsTopArtists);
    userArtists = artists.items;
    return artists.items;
}

async function getArtistTopTracks(id){
    let endPointArtistTop = `https://api.spotify.com/v1/artists/${id}/top-tracks`;
    let topTracks = await getData(endPointArtistTop, "N", "");
    return topTracks.tracks;
}

//////////////////////WORDINESS SCORE LOGIC////////////////////////////

let top5Tracks = [];
let top5Artists = [];

//blueprint for both top songs and artists//
class wordinessItem {
    constructor(name, picture, wordiness) {
        this.name = name;
        this.picture = picture;
        this.wordiness = wordiness;
    }
}

//converting a trackname and artist name into a useful form for webscraping//
function geniusURLify(track, artist) {;
    let trackNameURLFormatted = track;
    if(track.name.contains('Remastered')){
        trackNameURLFormatted = trackNameURLFormatted.substring
            (0, trackNameURLFormatted.indexOf('Remastered'));
    };
    trackNameURLFormatted  = 
        trackName.replace(/[^a-zA-Z0-9]/g, "").replace(" ", "-");
    let artistNameURLFormatted = artist.replace(/[^a-zA-Z0-9]/g, "").replace(" ", "-");
    return(artistNameURLFormatted + "-" + trackNameURLFormatted);
}

async function getArtistTopTracks(id) {
    let topTracksArray = await getArtistTopTracks(id);
    let topTrackNames = [];
    for (const track of topTracksArray) {
        topTrackNames.push(track.name);
    }
    return topTrackNames;
}

function getTrackWordiness(urlSearch) {

}

async function calculateArtistWordiness(id, name) {
    let allTracks = await getArtistTopTracks(id)
    let totalTrackWordiness = 0;
    allTracks.foreach(track => {
        totalTrackWordiness += getTrackWordiness(geniusURLify(track, name))});
    return totalTracksWordiness/allTracks.length;
}

async function getWordiestTracks() {
    let allTracks = [];
    for (const track of userTracks) {
        let name = track.name;
        let artist = track.artist[0];
        let wordiness = await getTrackWordiness(geniusURLify(name, artist));
        trimmedTrack = new wordinessItem(name, null, wordiness);
        allTracks.push(trimmedTrack);
    }
    allTracks.sort((a,b) => b.wordiness - a.wordiness);
    let wordiestTracks = allTracks.slice(0,5);
    top5Tracks = wordiestTracks;
}

async function getWordiestArtists() {
    trimmedArtists = getWordiest(userArtists, )
    let allArtists = [];
    for (const artist of userArtists) {
        let name = artist.name;
        let picture = artist.images[2];
        let wordiness = await calculateArtistWordiness(artist.id, name)
        trimmedArtist = new wordinessItem(name, picture, wordiness);
        allArtists.push(trimmedArtist);
    }
    allArtists.sort((a,b) => b.wordiness - a.wordiness);
    let wordiestArtists = allArtists.slice(0,5);
    top5Artists = wordiestArtists;
}

function calculateUserWordiness() {
    let totalWordiness = 0;
    for (const track of userTracks) {
        let artist = track.album.artists[0]
        let name = track.name;
    
        geniusURL = geniusURLify(name, artist);
        let wordiness = getTrackWordiness(geniusURL);
        totalWordiness += wordiness;
    }
}


app.get('/points', async function (req, res) {
    //tracks = await getTopArtists();
    //res.json(tracks);
    tracks = await getTopTracks();
    artists = await getTopArtists();
    console.log(tracks);
    console.log("------------------------tracks---------------------------------");
    console.log(artists);
    console.log("------------------------artists---------------------------------");
});


//starting the server
app.listen(port, () => {
    console.log("Hello I have started");
});
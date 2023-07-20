const express = require("express");
const querystring = require("querystring");
const axios = require('axios');
const https = require('https');
require('dotenv').config();
const app = express();
const port = 3001;

//serving static files//
app.use(express.static('views'));

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

/////////////////////API routes////////////////////////

//constants used in multiple routes//
const secret = process.env.SECRET;
console.log(secret);
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

let accessToken = "";
let refreshToken = "";

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
                console.log(response);
                accessToken = response.access_token;
                refreshToken = response.refresh_token;
                res.sendFile('score.html', { root: './views' });
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
app.get('refresh_token', function(req, res){
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
                console.log(response);
                accessToken = response.access_token;
            };
        });
    })

    post.on('error', (error) => {
        console.error(error);
    });
    post.write(postBody);
    post.end();
});

//starting the server
app.listen(port, () => {
    console.log("Hello I have started");
});
const express = require("express");
const QueryString = require("qs");
const app = express();
const port = 3001;

//serving static files//
app.use(express.static('views'));

//handling routes//
app.get('/', (req, res) => {
    res.sendFile('wordify.html', {root: './views'});
})

app.get('/about', (req, res) => {
    res.sendFile('about.html', {root: './views'})
})

app.get('/privacy', (req, res) => {
    res.sendFile('privacy.html', {root: './views'})
})

//start of API routes
const clientID = "ac87cd645d534f7e83940acbba480fb3";

app.get('/login', function(req, res){
    var authURL = "https://accounts.spotify.com/authorize?";
    res.redirect(authURL +
        QueryString.stringify({
            client_id: clientID,
            response_type: "code",
            redirect_uri: 'http://localhost:3001',
            scope: "user-top-read",
            show_dialog: "false"
        }));
});

//document.getElementById("login").addEventListener("click", requestAuth);

//starting the server
app.listen(port, () => {
    console.log("Hello I have startedddd");
});
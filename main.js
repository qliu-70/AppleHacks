require("./utils.js");

const express = require('express');
require('dotenv').config();
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
const session = require('express-session');
const saltRounds = 12;

const app = express();
const Joi = require("joi");
const port = process.env.PORT || 3000;

const expireTime = 1 * 60 * 60 * 1000; //expires after 1 hour  (hours * minutes * seconds * millis)

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

var { database } = include('databaseconnection');

const userCollection = database.db(mongodb_database).collection('users');

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: false }));

app.use(express.static('public'))
var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`, crypto: {
        secret: mongodb_session_secret
    }
})

app.use(session({
    secret: node_session_secret,
    store: mongoStore, //default is memory store 
    saveUninitialized: false,
    resave: true
}
));

app.get('/', (req, res) => {
    if (req.session.authenticated) {
        var html = `
        Hello, ${req.session.username}!
        <a href="/members"><button>Go to Members Area</button></a>
        <a href="/logout"><button>Logout</button></a>`
    }
    else {
        var html = `
        <a href="/signup"><button>Signup</button></a>
        <a href="/login"><button>Login</button></a>`
            ;
    }
    res.send(html);
});

app.listen(port, () => {
    console.log(`Server is Running on port ${port}`);
});
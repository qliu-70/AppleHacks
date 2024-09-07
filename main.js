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


const navLinks = [
    { name: 'Home', link: '/home' },
    { name: 'Profile', link: '/profile' },
    { name: 'Host', link: '/host' }
];

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
    res.render("index", { navLinks: navLinks })
});

app.get('/signup', (req, res) => {
    res.render('signup', { navLinks: navLinks })
})

app.post('/submitUser', async (req, res) => {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;

    const schema = Joi.object(
        {
            username: Joi.string().alphanum().max(20).required(),
            email: Joi.string().email({ tlds: { allow: false } }).required(),
            password: Joi.string().max(20).required()
        });

    const validationResult = schema.validate({ username, email, password });
    if (validationResult.error != null) {
        console.log(validationResult.error.details[0].path[0]);
        var error = validationResult.error.details[0].message;
        res.render("signup", { error: error, navLinks: navLinks });
        return;
    }
    var hashedPassword = await bcrypt.hash(password, saltRounds);

    await userCollection.insertOne({ username: username, email: email, password: hashedPassword });
    console.log("Inserted user");

    req.session.username = username;
    req.session.authenticated = true;
    req.session.cookie.maxAge = expireTime;
    res.redirect(`/profilesetup`);
});

app.get('/login', (req, res) => {
    res.render("login", { navLinks: navLinks })
})

app.post('/loggingin', async (req, res) => {
    var email = req.body.email;
    var password = req.body.password;

    const schema = Joi.object(
        {
            email: Joi.string().email({ tlds: { allow: false } }).required(),
            password: Joi.string().max(20).required()
        });

    const validationResult = schema.validate({ email, password });
    if (validationResult.error != null) {
        var error = validationResult.error.details[0].message;
        res.render("login", { error: error, navLinks: navLinks });
        return;
    }

    const result = await userCollection.find({ email: email }).project({ username: 1, password: 1, email: 1, _id: 1, user_type: 1 }).toArray();

    console.log(result);
    if (result.length != 1) {
        console.log("user not found");
        res.render("login", { error: "user not found", navLinks: navLinks });
        return;
    }
    if (await bcrypt.compare(password, result[0].password)) {
        console.log("correct password");
        req.session.authenticated = true;
        req.session.username = result[0].username;
        req.session.cookie.maxAge = expireTime;
        req.session.user_type = result[0].user_type

        res.redirect('/home');
        return;
    }
    else {
        console.log("incorrect password");
        res.render("login", { error: "pssword not found", navLinks: navLinks });
        return;
    }
});


app.get('/host', (req, res) => {
    res.render("host", { navLinks: navLinks })
})

app.post('/host-book-club', (req, res) => {
    const { btitle, bdescription, genres } = req.body;
    const genreArray = genres.split(',');

    res.send("Book club hosted successfully.");
});

app.listen(port, () => {
    console.log(`Server is Running on port ${port}`);
});
require("./utils.js");

const express = require('express');
require('dotenv').config();
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
const session = require('express-session');
const saltRounds = 12;
const { ObjectId } = require('mongodb');

const app = express();
const Joi = require("joi");
const port = process.env.PORT || 3000;
app.use(express.json());
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
const bookClubCollection = database.db(mongodb_database).collection('bookclub');

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: false }));


const navLinks = [
    { name: 'Home', link: '/home' },
    { name: 'Profile', link: '/profile' },
    { name: 'Host Bookclub', link: '/host' },
    { name: 'Join Bookclub', link: '/join' }
];

const popularGenres = ['Science Fiction', 'Fantasy', 'Mystery', 'Non-Fiction'
    , 'Romance', "Literary Fiction",
    "Historical Fiction",
    "Contemporary Fiction",
    "Thriller",
    "Biography & Memoir",
    "Classic Literature",
    "Magical Realism",
    "Young Adult",
    "Crime",
    "Poetry"]

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

app.get('/home', (req, res) => {
    if (req.session.username) {
        res.render('home', { username: req.session.username, navLinks: navLinks });
    } else {
        res.redirect('/login');
    }
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
    const result = await userCollection.find({ email: email }).project({ username: 1, password: 1, email: 1, _id: 1 }).toArray();
    console.log(result)
    if (result.length > 0) {
        res.render("signup", { error: "user already exists", navLinks: navLinks })
        return
    }
    var hashedPassword = await bcrypt.hash(password, saltRounds);

    await userCollection.insertOne({ username: username, email: email, password: hashedPassword, booksfinished: [] });
    console.log("Inserted user");

    req.session.email = email;
    req.session.username = username;
    req.session.authenticated = true;
    req.session.cookie.maxAge = expireTime;
    res.redirect(`/profilesetup`);
});

app.get('/profilesetup', async (req, res) => {
    var email = req.session.email
    const result = await userCollection.find({ email: email }).project().toArray();
    var username = req.session.username;
    var profilepic = result[0].profilepic;
    var fullname = result[0].fullname;
    var city = result[0].city;
    var genres = result[0].genre;
    var favouritebook = result[0].favouritebook;
    var reading = result[0].reading;
    var booksread = result[0].booksfinished.length;
    var title = result[0].title;
    res.render('profilesetup', { navLinks: navLinks, popularGenres:popularGenres, username: username, profilepic: profilepic, city: city, fullname: fullname, genres: genres, favouritebook: favouritebook, reading: reading, booksread: booksread, title: title, email: email });
})

app.post('/update-profile', async (req, res) => {
    const email = req.session.email;  // Get the logged-in user's email from session
    const { fullname, city} = req.body;

    await userCollection.updateOne(
        { email: email },
        { $set: { fullname: fullname, city: city } }
    );

    res.redirect('/profilesetup');  // Redirect back to profile setup page
});

// Route to handle favourite book updates
app.post('/update-favourite-book', async (req, res) => {
    const email = req.session.email;
    const { title, author, genres } = req.body;
    await userCollection.updateOne(
        { email: email },
        { $set: { favouritebook: { title: title, author: author, genres: genres.split(',').map(g => g.trim()) } } }
    );

    res.redirect('/profilesetup');
});

// Route to handle currently reading book updates
app.post('/update-currently-reading', async (req, res) => {
    const email = req.session.email;
    const { title, author, description } = req.body;

    await userCollection.updateOne(
        { email: email },
        { $set: { reading: { title: title, author: author, description: description } } }
    );

    res.redirect('/profilesetup');
});

app.post('/add-genres', async (req, res) => {
    const email = req.session.email; // Grab the email from the session
    const selectedGenres = req.body.genres;

    if (!Array.isArray(selectedGenres)) {
        return res.redirect('/profilesetup'); // Redirect if no genres are selected
    }

    // Add selected genres to the user's profile
    await userCollection.updateOne(
        { email: email },
        { $addToSet: { genre: { $each: selectedGenres } } } // Add selected genres only if they don't already exist
    );

    res.redirect('/profilesetup');
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

    const result = await userCollection.find({ email: email }).project({ username: 1, password: 1, email: 1, _id: 1 }).toArray();

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
        req.session.email = email;
        res.redirect('/home');
        return;
    }
    else {
        console.log("incorrect password");
        res.render("login", { error: "pssword not found", navLinks: navLinks });
        return;
    }
});

app.get('/profile', async (req, res) => {
    if (req.session.username) {
        var email = req.session.email
        const result = await userCollection.find({ email: email }).project().toArray();
        var username = req.session.username;
        var profilepic = result[0].profilepic;
        var fullname = result[0].fullname;
        var city = result[0].city;
        var genres = result[0].genre;
        var favouritebook = result[0].favouritebook;
        var reading = result[0].reading;
        var booksread = result[0].booksfinished.length
        var title = result[0].title
        res.render('profile', { navLinks: navLinks, username: username, profilepic: profilepic, city: city, fullname: fullname, genres: genres, favouritebook: favouritebook, reading: reading, booksread: booksread, title: title, email: email })
    } else {
        res.redirect('login');
    }
})


app.get('/host', (req, res) => {
    if (req.session.username) {
        res.render("host", { navLinks: navLinks })
    } else {
        res.redirect('login');
    }
})

app.post('/host-book-club', async (req, res) => {
    const { btitle, bdescription, genres } = req.body;
    const genreArray = genres.split(',').map(genre => genre.trim());
    email = req.session.email;
    username = req.session.username;

    const bookClubDocument = {
        title: btitle,
        description: bdescription,
        genres: genreArray,
        host: req.session.username,
        createdAt: new Date(),
        members:[email]
    };

    bookClubCollection.insertOne(bookClubDocument)
        .then(result => {
            res.status(200).send("Book club hosted successfully.");
        })
        .catch(err => {
            res.status(500).send("Failed to host book club.");
        });
});

app.get('/join', (req, res) => {
    if (req.session.username) {
        res.render("join", { navLinks: navLinks })
    } else {
        res.redirect('login')
    }
})

app.get('/get-book-clubs', async (req, res) => {
    try {
        const bookClubs = await bookClubCollection.find({}).toArray();
        res.status(200).json(bookClubs);
    } catch (err) {
        res.status(500).send("Failed to retrieve book clubs.");
    }
});

app.post('/join-book-club', async (req, res) => {
    const { bookClubId } = req.body;
    const username = req.session.username;

    if (!bookClubId || !username) {
        console.error("Missing bookClubId or username.");
        return res.status(400).send("Invalid request. Please provide a valid book club ID and ensure you are logged in.");
    }

    try {
        // Convert bookClubId to ObjectId
        const clubObjectId = new ObjectId(bookClubId);

        const result = await bookClubCollection.updateOne(
            { _id: clubObjectId },
            { $addToSet: { members: username } }
        );

        if (result.modifiedCount > 0) {
            console.log(`User ${username} successfully joined the book club ${bookClubId}.`);
            res.status(200).send("Successfully joined the book club.");
        } else {
            console.warn(`User ${username} already joined the book club ${bookClubId}.`);
            res.status(400).send("You have already joined this book club.");
        }
    } catch (err) {
        console.error("Failed to join the book club:", err);
        res.status(500).send("Failed to join the book club.");
    }
});




app.listen(port, () => {
    console.log(`Server is Running on port ${port}`);
});
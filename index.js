const express = require('express');
const app = express();
const admin = require('firebase-admin');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const request = require('request');
const crypto = require('crypto');

const credentials = require('./package.json');

admin.initializeApp({
  credential: admin.credential.cert(credentials),
});

const db = admin.firestore();
const PORT = 3004;

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const secretKey = crypto.randomBytes(32).toString('hex');

app.use(
  session({
    secret: secretKey,
    resave: false,
    saveUninitialized: true,
  })
);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('signin');
});

app.get('/signin', (req, res) => {
  res.render('signin');
});

app.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userSnapshot = await db.collection('user').where('email', '==', email).get();
    if (userSnapshot.empty) {
      return res.status(400).send('User not found');
    }

    const user = userSnapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).send('Invalid password');
    }

    req.session.user = { email: user.email, name: user.name };
    res.redirect('/movie');
  } catch (error) {
    console.error('Error occurred', error);
    res.status(500).send('Error logging in');
  }
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userSnapshot = await db.collection('user').where('email', '==', email).get();
    if (!userSnapshot.empty) {
      return res.status(400).send('Email already in use');
    }

    const hashPassword = await bcrypt.hash(password, 10);
    await db.collection('user').add({
      name: name,
      email: email,
      password: hashPassword,
    });

    // Redirect to the movie page after signing up
    res.redirect('/movie');
  } catch (error) {
    console.error('Error occurred', error);
    res.status(500).send('Error signing up');
  }
});

app.get('/movie', (req, res) => {
  const apiKey = '706f9753'; // Your OMDB API key
  const movieId = req.query.id;

  if (!movieId) {
    res.render('movie');
  } else {
    request(`http://www.omdbapi.com/?i=${movieId}&apikey=${apiKey}`, function (err, response, body) {
      if (err) {
        console.error('Error fetching movie details:', err);
        return res.status(500).send('Error fetching movie details');
      }

      try {
        const movieData = JSON.parse(body);
        res.render('movie', { movieData });
      } catch (parseError) {
        console.error('Error parsing movie data:', parseError);
        res.status(500).send('Error parsing movie data');
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

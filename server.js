const mysql = require('mysql2');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'sana123',
    database: 'project'
});

connection.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('MySQL connected successfully.....');
});

const app = express();

app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://apis.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
    }
}));

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serving static files
app.use('/views', express.static('views'));
app.use('/Public', express.static('Public'));

// Handle signup functionality
app.post('/register', function(request, response) {
    let { Name, Email, password } = request.body;

    if (Name && Email && password) {
        connection.query('INSERT INTO registration (Name, Email, password) VALUES (?, ?, ?)', [Name, Email, password], function(error, results) {
            if (error) {
                response.send('Database error.');
                return;
            }

            request.session.loggedin = true;
            request.session.Email = Email;
            response.redirect('/login');
        });
    } else {
        response.send('Please enter all required fields!');
    }
});

// Handle login functionality
app.post('/login', function(request, response) {
    let { Email, password } = request.body;

    if (Email && password) {
        connection.query('SELECT * FROM registration WHERE Email = ? AND password = ?', [Email, password], function(error, results) {
            if (error) {
                response.send('Database error.');
                return;
            }

            if (results.length > 0) {
                request.session.loggedin = true;
                request.session.Email = Email;

                if (results[0].is_voter) {
                    response.redirect('/dash');
                } else {
                    response.redirect('/voter-candidate');
                }
            } else {
                response.send('Incorrect Username or Password!');
            }
        });
    } else {
        response.send('Please enter Email and Password!');
    }
});

// Handle voter registration
app.post('/submit_registration', (req, res) => {
    const { Name, Email, password, DateOfBirth, CNIC, Mobile_Num } = req.body;

    connection.query('SELECT * FROM voter WHERE CNIC = ?', [CNIC], (err, results) => {
        if (err) {
            console.error('Error querying the database:', err.stack);
            res.send('Database error.');
            return;
        }

        if (results.length > 0) {
            res.send('This CNIC is already registered.');
        } else {
            connection.query('INSERT INTO voter (Name, Email, password, DateOfBirth, CNIC, Mobile_Num) VALUES (?, ?, ?, ?, ?, ?)', [Name, Email, password, DateOfBirth, CNIC, Mobile_Num], (err, results) => {
                if (err) {
                    console.error('Error inserting into the database:', err.stack);
                    res.send('Database error.');
                    return;
                }

                connection.query('UPDATE registration SET is_voter = true WHERE Email = ?', [req.session.Email], (err, results) => {
                    if (err) {
                        console.error('Error updating the database:', err.stack);
                        res.send('Database error.');
                        return;
                    }

                    res.redirect('/dash');
                });
            });
        }
    });
});

// Routes
app.get('/home', (req, res) => {
    res.render("home.ejs");
});

app.get('/', (req, res) => {
    res.render("index.ejs");
});

app.get('/registration', (req, res) => {
    res.render("register.ejs");
});

app.get('/login', (req, res) => {
    res.render("login.ejs");
});

app.get('/voter-candidate', (req, res) => {
    res.render("btns.ejs");
});

app.get('/voter', (req, res) => {
    res.render("voter.ejs");
});

app.get('/candidate', (req, res) => {
    res.render("candidate.ejs");
});

app.get('/dash', (req, res) => {
    if (req.session.loggedin) {
        res.render("dash.ejs");
    } else {
        res.send('Please login to view this page!');
    }
});

app.listen(4000, () => {
    console.log('Server is running on port 4000');
});

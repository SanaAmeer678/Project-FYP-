

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
app.use('/web-fonts-with-css', express.static('web-fonts-with-css'));

// Handle signup functionality
app.post('/register', function (request, response) {
    let { Name, Email, password } = request.body;

    if (Name && Email && password) {
        connection.query('INSERT INTO registration (Name, Email, password) VALUES (?, ?, ?)', [Name, Email, password], function (error, results) {
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
app.post('/login', function (request, response) {
    let Email = request.body.Email;
    let password = request.body.password;

    if (Email && password) {
        connection.query('SELECT * FROM registration WHERE Email = ? AND password = ?', [Email, password], function (error, results, fields) {
            if (error) throw error;

            if (results.length > 0) {
                request.session.loggedin = true;
                request.session.Email = Email;

                // Check if the user is already a voter
                if (results[0].is_voter) {
                    response.redirect('/dash');
                } else {
                    response.redirect('/voter-candidate');
                }
            } else {
                response.send('Incorrect Username or Password!');
            }
            response.end();
        });
    } else {
        response.send('Please enter Email and Password!');
        response.end();
    }
});


// Handle Admin login functionality
app.post('/admin-login', function (request, response) {
    let Name = request.body.Name;
    let Email = request.body.Email;
    let password = request.body.password;

    if (Email && password) {
        connection.query('SELECT * FROM admin WHERE Name = ? AND Email = ? AND password = ?', [Name, Email, password], function (error, results, fields) {
            if (error) throw error;

            if (results.length > 0) {
                request.session.loggedin = true;
                request.session.Email = Email;
                response.redirect('/admin-dashboard');
            } else {
                response.send('Incorrect Username or Password!');
            }
        });
    } else {
        response.send('Please enter Email and Password!');
        response.end();
    }
});

// Handle election poll functionality
app.post('/create-election', (req, res) => {
    const { electionID, election_Name, StartDate, EndDate } = req.body;

    // Check if all required fields are provided
    if (!electionID || !election_Name || !StartDate || !EndDate) {
        return res.status(400).send('Please fill in all required fields: electionID, election_Name, StartDate, and EndDate.');
    }

    // Process the data and save it to the database
    connection.query(
        'INSERT INTO election (electionID, election_Name, StartDate, EndDate) VALUES (?, ?, ?, ?)',
        [electionID, election_Name, StartDate, EndDate],
        function (error, results) {
            if (error) {
                console.error('Database error:', error);
                return res.status(500).send('There was an error processing your request. Please try again later.');
            }
            // Send a response back to the user
            res.send('Election created successfully!');
        }
    );
});


// Handle voter registration
app.post('/submit_registration', (req, res) => {
    const { Name, CNIC, Email, password, Rollno, University, Department, Semester } = req.body;

    connection.query('SELECT * FROM voter WHERE CNIC = ?', [CNIC], (err, results) => {
        if (err) {
            console.error('Error querying the database:', err.stack);
            res.send('Database error.');
            return;
        }

        if (results.length > 0) {
            res.send('This CNIC is already registered.');
        } else {
            connection.query('INSERT INTO voter (Name,CNIC, Email, password,Rollno,University,Department,Semester) VALUES (?,?,?,?,?,?,?, ?)', [Name, CNIC, Email, password, Rollno, University, Department, Semester], (err, results) => {
                if (err) {
                    console.error('Error inserting into the database:', err.stack);
                    res.send('Database error.');
                    return;
                }

                // Update the is_voter flag
                connection.query('UPDATE registration SET is_voter = true WHERE Email = ?', [req.session.Email], (err, results) => {
                    if (err) {
                        console.error('Error updating the database:', err.stack);
                        res.send('Database error.');
                        return;
                    }

                    // Redirect to dashboard
                    res.redirect('/dash');
                });
            });
        }
    });
});


// Handle candidate registration
app.post('/candidate', (req, res) => {
    const { candidate_Name, electionID, DateOfBirth, Email, password, Department, Position } = req.body;

    if (!candidate_Name || !electionID || !DateOfBirth || !Email || !password || !Department || !Position) {
        res.send('Please fill all fields!');
        return;
    }

    connection.query('SELECT * FROM candidate WHERE Email = ?', [Email], (err, results) => {
        if (err) {
            console.error('Error querying the database:', err.stack);
            res.send('Database error.');
            return;
        }

        if (results.length > 0) {
            res.send('This Email is already registered.');
        } else {
            connection.query('INSERT INTO candidate (candidate_Name, electionID, DateOfBirth, Email, password,Department,Position) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [candidate_Name, electionID, DateOfBirth, Email, password, Department, Position], (err, results) => {
                    if (err) {
                        console.error('Error inserting into the database:', err.stack);
                        res.send('Database error.');
                        return;
                    }

                    connection.query('UPDATE registration SET is_candidate = true WHERE Email = ?', [Email], (err, results) => {
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


//voters list functionality
app.get('/voters-list', (req, res) => {
    const query = 'SELECT * FROM voter'; // Ensure this query matches your database schema and table name

    connection.query(query, (err, results) => {
        if (err) {
            return res.status(500).send('Database query failed');
        }
        // console.log(results); // Add this line to check what data is being fetched
        res.render('voters-list.ejs', { voters: results });
    });
});


// Route to display elections available for voting
app.get('/election-poll', function (req, res) {
    connection.query('SELECT * FROM election', function (error, results) {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).send('There was an error retrieving elections.');
        }
        res.render('election-poll.ejs', { elections: results });
    });
});


// Route to display Position selection based on selected election
app.post('/position', function (req, res) {
    const electionID = req.body.electionID;

    // Query to get the list of Position for the selected election
    connection.query('SELECT DISTINCT Position FROM candidate WHERE electionID = ?', [electionID], function (error, results) {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).send('There was an error retrieving Position.');
        }

        if (results.length === 0) {
            return res.send('No Position found for the selected election.');
        }

        // Render a page where the user can select a Position
        res.render('position.ejs', { Positions: results, electionID: electionID });
    });
});


//  // Route to display candidates based on selected election
// app.post('/vote-cast', function (req, res) {
//     const electionID = req.body.electionID;
//     connection.query('SELECT * FROM candidate WHERE electionID = ?', [electionID], function (error, results) {
//         if (error) {
//             console.error('Database error:', error);
//             return res.status(500).send('There was an error retrieving candidates.');
//         }
//         res.render('vote-cast.ejs', { candidates: results, electionID: electionID });

//     });
// });


app.post('/vote-cast', function (req, res) {
    const electionID = req.body.electionID;
    connection.query('SELECT * FROM candidate WHERE electionID = ?', [electionID], function (error, results) {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).send('There was an error retrieving candidates.');
        }
        console.log(results); // This will print the results to the console
        res.render('vote-cast.ejs', { candidates: results, electionID: electionID });
    });
});

app.post('/results', (req, res) => {
    let electionID = req.body.electionID;
    const candidateID = req.body.candidateID;
    const voterID = req.body.voterID;
    const timestamp = new Date();

    // Ensure electionID is a string or a number
    if (Array.isArray(electionID)) {
        electionID = electionID.find(id => id.trim() !== ''); // Find the first non-empty string
    }

    console.log('Received electionID:', electionID);

    if (!electionID || isNaN(electionID)) {
        return res.status(400).send('Election ID is invalid.');
    }

    connection.query(
        'INSERT INTO result (electionID, candidateID, voterID, timestamp) VALUES (?, ?, ?, ?)',
        [electionID, candidateID, voterID, timestamp],
        function (error, results) {
            if (error) {
                console.error('Error inserting vote:', error);
                return res.status(500).send('Error submitting your vote.');
            }
            return res.send('Your vote was submitted successfully.');
        }
    );
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

app.get('/admin-login', (req, res) => {
    res.render("admin.ejs");
});

app.get('/admin-dashboard', (req, res) => {
    res.render("admin-dash.ejs");
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
        res.render('dash.ejs');
    } else {
        res.send('Please login to view this page!');
    }
});

app.get('/election-poll', (req, res) => {
    res.render("election-poll.ejs");
});

app.get('/position', (req, res) => {
    res.render("position.ejs");
});

app.get('/vote-cast', (req, res) => {
    res.render("vote-cast.ejs");
});


app.get('/results', async (req, res) => {
    try {
        const [results] = await connection.promise().query(`
            SELECT 
                e.election_Name, 
                c.candidate_Name, 
                COUNT(v.resultID) as voteCount
            FROM 
                result v
            JOIN 
                candidate c ON v.candidateID = c.candidateID
            JOIN 
                election e ON v.electionID = e.electionID
            GROUP BY 
                v.candidateID, e.election_Name, c.candidate_Name;
        `);

        res.render('results.ejs', { results: results });

    } catch (error) {
        console.error('Error retrieving results:', error.stack);
        return res.status(500).send('Database error.');
    }
});


app.listen(4000, () => {
    console.log('Server is running on port 4000');
});

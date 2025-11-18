// app.js - SECURE VERSION
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');
const csrf = require('csurf');
const helmet = require('helmet');
const winston = require('winston');
const morgan = require('morgan');
const app = express();
const db = new sqlite3.Database('./taskvault.db');

// === SECURITY MIDDLEWARE ===
app.use(helmet());                                      // Secure headers
app.use(morgan('combined'));                            // Logging
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session (secure settings)
app.use(session({
  secret: 'super-strong-secret-2025!',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,        // set true in production with HTTPS
    maxAge: 15 * 60 * 1000 // 15 mins
  }
}));

// CSRF Protection
const csrfProtection = csrf({ cookie: false });
app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'app.log' }),
    new winston.transports.Console()
  ]
});

// === ROUTES ===

// Home - Login
app.get('/', (req, res) => {
  res.render('login');
});

// Register
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.send('All fields required');
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.send('Hash error');

    db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')`,
      [name, email, hash], function(err) {
        if (err) return res.send('Email already exists');
        logger.info(`New user registered: ${email}`);
        res.redirect(303, '/');
      });
  });
});

// Login - SECURE
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      logger.warn(`Failed login attempt: ${email}`);
      return res.send('Invalid credentials');
    }

    req.session.user = { id: user.id, email: user.email, role: user.role };
    logger.info(`User logged in: ${email}`);
    res.redirect('/dashboard');
  });
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');

  db.all(`SELECT * FROM tasks WHERE userId = ?`, [req.session.user.id], (err, tasks) => {
    if (err) return res.send('Error');
    res.render('dashboard', { tasks, user: req.session.user });
  });
});

// Add Task - CSRF + ESCAPED OUTPUT
app.post('/task', csrfProtection, (req, res) => {
  if (!req.session.user) return res.redirect('/');

  const { title, description } = req.body;
  const userId = req.session.user.id;

  db.run(`INSERT INTO tasks (userId, title, description) VALUES (?, ?, ?)`,
    [userId, title, description], (err) => {
      if (err) return res.send('Error adding task');
      res.redirect('/dashboard');
    });
});

// Admin Panel - NO PASSWORDS RETURNED
app.get('/admin', (req, res) => {
  if (req.session.user?.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }

  db.all(`SELECT id, name, email FROM users`, (err, users) => {
    db.all(`SELECT * FROM tasks`, (err2, tasks) => {
      res.render('admin', { users, tasks });
    });
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect(303, '/');
  });
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SECURE APP RUNNING: http://localhost:${PORT}`);
});
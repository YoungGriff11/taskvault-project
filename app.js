// This version fixes ALL major vulnerabilities from the insecure app:
// ✓ SQL Injection prevented with parameterized queries
// ✓ Passwords hashed with bcrypt
// ✓ XSS prevented via proper output escaping in EJS + no unsafe reflection
// ✓ CSRF protection enabled
// ✓ Secure session cookies (HttpOnly, shorter lifetime)
// ✓ Helmet for secure HTTP headers
// ✓ Proper logging (no sensitive data leaked)
// ✓ No plaintext passwords in admin panel

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');          // For secure password hashing
const csrf = require('csurf');             // CSRF protection
const helmet = require('helmet');          // Sets secure HTTP headers
const winston = require('winston');        // Professional logging
const morgan = require('morgan');          // HTTP request logging
const app = express();
const db = new sqlite3.Database('./taskvault.db');

// SECURITY MIDDLEWARE

app.use(helmet());                                      // Adds security headers (e.g., X-XSS-Protection, HSTS, etc.)
app.use(morgan('combined'));                            // Logs all requests (great for monitoring attacks)
app.use(express.urlencoded({ extended: true }));        // Safely parse form data
app.use(express.static('public'));                      // Serve CSS/JS/images
app.set('view engine', 'ejs');                          // Template engine (EJS auto-escapes output by default)

// Secure session configuration
app.use(session({
  secret: 'super-strong-secret-2025!',                  // Use environment variable in real apps!
  resave: false,                                        // Better performance
  saveUninitialized: false,                             // Don't create sessions for unauthenticated users
  cookie: {
    httpOnly: true,                                     // Prevents JavaScript access to cookies → stops XSS theft
    secure: false,                                      // SET TO TRUE in production when using HTTPS
    maxAge: 15 * 60 * 1000                              // 15-minute session → reduces hijacking window
  }
}));

// CSRF Protection Middleware
const csrfProtection = csrf({ cookie: false });         // Tokens stored in session (more secure than cookies)
app.use(csrfProtection);

// Make CSRF token available in all templates
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();               // So forms can include <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  next();
});

// Professional logging with Winston (logs to file + console, no sensitive data)
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

// ROUTES
// Home - Login Page
app.get('/', (req, res) => {
  res.render('login');                                   // CSRF token automatically available in template
});

// Register Page
app.get('/register', (req, res) => {
  res.render('register');
});

// REGISTER USER - SECURE
app.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.send('All fields required');
  }

  // Hash password securely (10 salt rounds)
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.send('Hash error');

    // Parameterized query → NO SQL INJECTION possible
    db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')`,
      [name, email, hash], function(err) {
        if (err) return res.send('Email already exists'); // Friendly message (check DB constraint in real app)
        logger.info(`New user registered: ${email}`);
        res.redirect(303, '/');                         // Redirect to login
      });
  });
});

// LOGIN - SECURE
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Parameterized query → safe from SQL injection
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) throw err;

    // Compare entered password with stored hash
    if (!user || !bcrypt.compareSync(password, user.password)) {
      logger.warn(`Failed login attempt: ${email}`);
      return res.send('Invalid credentials');
    }

    // Store ONLY safe data in session (never store password!)
    req.session.user = { id: user.id, email: user.email, role: user.role };
    logger.info(`User logged in: ${email}`);
    res.redirect('/dashboard');
  });
});

// DASHBOARD - Protected + Safe
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');

  // Parameterized query
  db.all(`SELECT * FROM tasks WHERE userId = ?`, [req.session.user.id], (err, tasks) => {
    if (err) return res.send('Error loading tasks');
    
    // EJS auto-escapes task.title and task.description → NO XSS possible
    // No unsafe query params passed to template → DOM XSS fixed
    res.render('dashboard', { tasks, user: req.session.user });
  });
});

// ADD TASK - Protected with CSRF + Safe from XSS
app.post('/task', csrfProtection, (req, res) => {
  if (!req.session.user) return res.redirect('/');

  const { title, description } = req.body;
  const userId = req.session.user.id;

  // Parameterized query → safe from SQL injection
  // User input saved as-is, but EJS will auto-escape when displayed → prevents Stored XSS
  db.run(`INSERT INTO tasks (userId, title, description) VALUES (?, ?, ?)`,
    [userId, title, description], (err) => {
      if (err) return res.send('Error adding task');
      res.redirect('/dashboard');
    });
});

// ADMIN PANEL - Secure (no passwords exposed)
app.get('/admin', (req, res) => {
  if (req.session.user?.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }

  // NEVER select passwords!
  db.all(`SELECT id, name, email FROM users`, (err, users) => {
    if (err) return res.send('Error loading users');
    
    db.all(`SELECT * FROM tasks`, (err2, tasks) => {
      if (err2) return res.send('Error loading tasks');
      res.render('admin', { users, tasks });
    });
  });
});

// LOGOUT - Secure session destruction
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect(303, '/');
  });
});

// SERVER START
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SECURE APP RUNNING: http://localhost:${PORT}`);
});
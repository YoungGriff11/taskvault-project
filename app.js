// This app demonstrates MULTIPLE critical security vulnerabilities:
// - SQL Injection
// - Plaintext Password Storage
// - Stored & Reflected & DOM-based XSS
// - Weak Session Configuration
// - Sensitive Data Exposure

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");

const app = express();
const db = new sqlite3.Database("./taskvault.db"); //file-based DB

// MIDDLEWARE SETUP

app.set("view engine", "ejs"); // Use EJS templates
app.use(express.urlencoded({ extended: true })); // Parse form bodies
app.use(express.static("public")); // Serve static files (CSS, JS, images)
app.use(
  session({
    secret: "weaksecret", // Hardcoded secret → predictable sessions
    resave: true, // Forces session save even if unchanged
    saveUninitialized: true, // Saves new but unmodified sessions
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24-hour cookie
  })
);

// ROUTES
// Home Route → Shows login page
app.get("/", (req, res) => {
  res.render("login");
});

// Registration page (GET)
app.get("/register", (req, res) => {
  res.render("register");
});

// REGISTER USER - POST
// SQL Injection + Plaintext passwords
app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  // Basic validation (still allows malicious input)
  if (!name || !email || !password) {
    return res.send("All fields are required");
  }

  // Direct string interpolation → Classic SQL Injection vulnerability
  // Also stores password in PLAINTEXT!
  const sql = `INSERT INTO users (name, email, password, role) VALUES ('${name}', '${email}', '${password}', 'user')`;

  db.run(sql, function (err) {
    if (err) {
      // Leaks database error messages (useful for error-based SQLi)
      return res.send(`Error: ${err.message}`);
    }
    console.log(`User registered: ${email} (ID: ${this.lastID})`);
    res.redirect(303, "/"); // 303 forces GET after POST
  });
});

// LOGIN - POST
// Vulnerable to SQL Injection (' OR '1'='1 login bypass)
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  //Raw user input in query → SQL Injection possible
  const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;

  db.get(query, (err, user) => {
    if (err || !user) {
      return res.send("Invalid credentials");
    }
    req.session.user = user; // Store entire user object in session
    res.redirect("/dashboard");
  });
});

// DASHBOARD - Protected route
// Also contains DOM-based XSS via query parameter
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const userId = req.session.user.id;

  // Vulnerable to SQLi if userId were manipulated (currently safe because from session)
  db.all(`SELECT * FROM tasks WHERE userId = ${userId}`, (err, tasks) => {
    if (err) return res.send("Error loading tasks");

    // DOM-XSS VULNERABILITY
    // Because EJS will output this unsanitized into the page
    res.render("dashboard", {
      tasks,
      user: req.session.user,
      inject: req.query.inject, // Direct injection into template → DOM XSS
    });
  });
});

// ADD TASK - POST
// STORED XSS Vulnerability
app.post("/task", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { title, description } = req.body;
  const userId = req.session.user.id;

  // Only escapes single quotes for SQL → still allows XSS payloads
  const escapeSql = (str) => str.replace(/'/g, "''");
  const safeTitle = escapeSql(title);
  const safeDesc = escapeSql(description);

  // Still vulnerable to SQLi if input contains tricks, and XSS is fully allowed
  const sql = `INSERT INTO tasks (userId, title, description) VALUES (${userId}, '${safeTitle}', '${safeDesc}')`;

  db.run(sql, (err) => {
    if (err) return res.send("Error adding task");
    res.redirect("/dashboard");
  });
});

// REFLECTED XSS Endpoint
app.get("/search", (req, res) => {
  const q = req.query.q || "";

  // Direct reflection of user input → Reflected XSS
  res.send(`
    <h1>Search Results for: ${q}</h1>
    <a href="/">Back</a>
  `);
});

// ADMIN PANEL - Privilege escalation + Sensitive Data Exposure
app.get("/admin", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Access Denied");
  }

  // Exposes ALL users' passwords in plaintext!
  db.all(`SELECT id, name, email, password FROM users`, (err, users) => {
    if (err) return res.send("Error");
    db.all(`SELECT * FROM tasks`, (err, tasks) => {
      if (err) return res.send("Error");
      // Renders admin page with full user list including passwords
      res.render("admin", { users, tasks });
    });
  });
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.send("Error logging out");
    }
    res.redirect(303, "/");
  });
});

//SERVER START
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`INSECURE APP RUNNING: http://localhost:${PORT}`);
});

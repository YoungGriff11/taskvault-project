// app.js - INSECURE VERSION (FULLY WORKING)
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const app = express();
const db = new sqlite3.Database("./taskvault.db");

// Middleware
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: "weaksecret",
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

// === ROUTES ===

// Home - Login Page
app.get("/", (req, res) => {
  res.render("login");
});

// Register Page (GET)
app.get("/register", (req, res) => {
  res.render("register");
});

// Register User (POST) - INSECURE
app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.send("All fields are required");
  }

  // INSECURE: Plaintext password + SQL Injection possible
  const sql = `INSERT INTO users (name, email, password, role) VALUES ('${name}', '${email}', '${password}', 'user')`;

  db.run(sql, function (err) {
    if (err) {
      return res.send(`Error: ${err.message}`);
    }
    console.log(`User registered: ${email} (ID: ${this.lastID})`);
    res.redirect(303, "/"); // FORCE REDIRECT
  });
});

// Login (POST) - SQL INJECTION VULNERABLE
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // VULNERABLE: Raw SQL string
  const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;

  db.get(query, (err, user) => {
    if (err || !user) {
      return res.send("Invalid credentials");
    }
    req.session.user = user;
    res.redirect("/dashboard");
  });
});

// Dashboard - User Tasks + DOM XSS
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const userId = req.session.user.id;
  db.all(`SELECT * FROM tasks WHERE userId = ${userId}`, (err, tasks) => {
    if (err) return res.send("Error loading tasks");
    res.render("dashboard", {
      tasks,
      user: req.session.user,
      inject: req.query.inject, // DOM XSS
    });
  });
});

// Add Task (POST) - STORED XSS
app.post("/task", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { title, description } = req.body;
  const userId = req.session.user.id;

  // STORED XSS: No sanitization
  // ESCAPE SINGLE QUOTES TO ALLOW XSS
  const escapeSql = (str) => str.replace(/'/g, "''");
  const safeTitle = escapeSql(title);
  const safeDesc = escapeSql(description);

  const sql = `INSERT INTO tasks (userId, title, description) VALUES (${userId}, '${safeTitle}', '${safeDesc}')`;
  db.run(sql, (err) => {
    if (err) return res.send("Error adding task");
    res.redirect("/dashboard");
  });
});

// Reflected XSS
app.get("/search", (req, res) => {
  const q = req.query.q || "";
  // REFLECTED XSS
  res.send(`
    <h1>Search Results for: ${q}</h1>
    <a href="/">Back</a>
  `);
});

// Admin Panel - SENSITIVE DATA EXPOSURE
app.get("/admin", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Access Denied");
  }

  db.all(`SELECT id, name, email, password FROM users`, (err, users) => {
    if (err) return res.send("Error");
    db.all(`SELECT * FROM tasks`, (err, tasks) => {
      if (err) return res.send("Error");
      res.render("admin", { users, tasks });
    });
  });
});

// === LOGOUT ROUTE ===
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.send("Error logging out");
    }
    res.redirect(303, "/"); // Force redirect to login
  });
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`INSECURE APP RUNNING: http://localhost:${PORT}`);
});

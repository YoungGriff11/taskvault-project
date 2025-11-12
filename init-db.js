// init-db.js
const sqlite = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const db = new sqlite3.database("./taskvault.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT "user"
  )`);

db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    title TEXT,
    description TEXT,
    dueDate TEXT,
    priority TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);
  
db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    level TEXT,
    message TEXT
  )`);
  
// Seed admin
  bcrypt.hash("Admin123!", 10, (err, hash) => {
    if (err) console.error(err);
    db.run(`INSERT OR IGNORE INTO users (name, email, password, role) 
            VALUES ("Admin", "admin@taskvault.com", ?, "admin")`, [hash]);
  });
});

db.close();
console.log("DB initialised: taskvault.db");
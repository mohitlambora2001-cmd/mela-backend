const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mela.db');

db.serialize(() => {
    // Keep your original users table
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)");
    
    // NEW: Create a table specifically for chat messages
    db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, text TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
    
    console.log("Database tables checked/created successfully!");
});

db.close();

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mela.db'); // This creates/opens the database file

db.serialize(() => {
  // 1. Create a table if it doesn't exist
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)");
  
  // 2. Insert a test user
  db.run("INSERT INTO users (name, email) VALUES ('Mohit', 'mohit@example.com')", (err) => {
    if (err) {
      console.error("Error inserting data:", err.message);
    } else {
      console.log("Table created and test user inserted!");
    }
  });
});

db.close();
0


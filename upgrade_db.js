const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mela.db');

db.serialize(() => {
    db.run("ALTER TABLE messages ADD COLUMN room TEXT DEFAULT 'Global'", (err) => {
        if (err) console.log("Room column is ready!");
        else console.log("Successfully added 'room' column to database!");
    });
});
db.close();

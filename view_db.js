const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DB_PATH = path.join(__dirname, 'busticket.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    }
});

db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) {
        console.error('Error fetching tables:', err.message);
    } else {
        console.log('Tables in database:');
        tables.forEach(table => {
            console.log(`- ${table.name}`);
        });

        // Show some sample data for each table
        tables.forEach(table => {
            db.all(`SELECT * FROM ${table.name} LIMIT 3;`, (err, rows) => {
                if (!err) {
                    console.log(`\n--- Sample data for ${table.name} (first 3 rows) ---`);
                    console.table(rows);
                }
            });
        });
    }

    // Close the DB after some time to allow async calls to finish
    setTimeout(() => db.close(), 1000);
});

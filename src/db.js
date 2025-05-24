const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node'); // for CommonJS
const path = require('path');

// Path to db.json
const dbPath = path.join(__dirname, '..', 'db.json'); // Assumes db.js is in src and db.json is in root

const adapter = new JSONFile(dbPath);
const db = new Low(adapter);

// Function to initialize database if it's empty
async function initializeDatabase() {
  await db.read();
  db.data = db.data || { users: [], events: [] }; // Initialize if null or empty
  await db.write();
}

// Call initialize and export db
// We'll call initializeDatabase in server.js before starting the server
module.exports = { db, initializeDatabase };

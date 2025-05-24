const low = require('lowdb');
const FileAsync = require('lowdb/adapters/FileAsync');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db.json');
const adapter = new FileAsync(dbPath);
const db = low(adapter); // db is the lowdb instance

async function initializeDatabase() {
  await db.read(); // This is key for v3 to populate db.data
  db.data = db.data || { users: [], events: [] }; // Initialize if null (new file) or ensure structure
  // Ensure keys exist even if db.data was an empty object from an empty file
  if (typeof db.data.users === 'undefined') db.data.users = [];
  if (typeof db.data.events === 'undefined') db.data.events = [];
  await db.write();
}

module.exports = { db, initializeDatabase };

const jsonfile = require('jsonfile');
const path = require('path');
const fs = require('fs'); // To check file existence initially

const dbPath = path.join(__dirname, '..', 'db.json');
const defaultData = { users: [], events: [] };

async function initializeDatabase() {
  try {
    // Check if the file exists
    if (fs.existsSync(dbPath)) {
      // File exists, try to read it
      const data = await jsonfile.readFile(dbPath);
      // Ensure top-level keys exist
      let changed = false;
      if (typeof data.users === 'undefined') {
        data.users = [];
        changed = true;
      }
      if (typeof data.events === 'undefined') {
        data.events = [];
        changed = true;
      }
      if (changed) {
        await jsonfile.writeFile(dbPath, data, { spaces: 2 });
      }
    } else {
      // File does not exist, create it with default data
      await jsonfile.writeFile(dbPath, defaultData, { spaces: 2 });
      console.log('New db.json created with default structure.');
    }
  } catch (error) {
    // If there was an error reading (e.g., corrupted JSON) or file existed but was empty
    // or any other FS issue during the check, try to overwrite with default data.
    console.error('Error initializing database, attempting to create/overwrite with default:', error);
    try {
      await jsonfile.writeFile(dbPath, defaultData, { spaces: 2 });
      console.log('db.json created/overwritten with default structure due to initialization error.');
    } catch (writeError) {
      console.error('CRITICAL: Could not write default db.json:', writeError);
      // If this fails, the app likely can't proceed.
      throw writeError; // Re-throw critical error
    }
  }
}

module.exports = { 
  dbPath, 
  initializeDatabase 
  // No 'db' instance is exported anymore, models will use jsonfile directly with dbPath
};

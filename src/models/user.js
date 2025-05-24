const bcrypt = require('bcrypt');
const { db } = require('../db'); // Assuming db.js exports { db, initializeDatabase }

const SALT_ROUNDS = 10;

async function createUser(username, password, role, defaultPasswordChanged = true) {
  await db.read();
  // Initialize users array if it doesn't exist
  if (!db.data.users) {
    db.data.users = [];
  }
  
  const existingUser = db.data.users.find(u => u.username === username);
  if (existingUser) {
    throw new Error('User already exists');
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  const user = { 
    id: Date.now().toString(), // Simple ID generation
    username, 
    hashedPassword, 
    role, 
    defaultPasswordChanged 
  };
  
  db.data.users.push(user);
  await db.write();
  
  // Return user object without password for security
  const { hashedPassword: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

async function findUserByUsername(username) {
  await db.read();
  // Initialize users array if it doesn't exist (should not happen if initializeDatabase was called)
  if (!db.data.users) {
    db.data.users = [];
    return undefined; // Or handle as an error / unexpected state
  }
  const user = db.data.users.find(u => u.username === username);
  return user;
}

async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

async function updateUserPassword(userId, newPassword) {
  await db.read();
  const userIndex = db.data.users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    throw new Error('User not found');
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  db.data.users[userIndex].hashedPassword = hashedPassword;
  db.data.users[userIndex].defaultPasswordChanged = true;
  
  await db.write();
  
  // Return a representation of the updated user (without password)
  const { hashedPassword: _, ...updatedUser } = db.data.users[userIndex];
  return updatedUser;
}

module.exports = {
  createUser,
  findUserByUsername,
  verifyPassword,
  updateUserPassword, // Add this export
  findUserById,
};

async function findUserById(userId) {
  await db.read();
  // Ensure users array exists
  db.data.users = db.data.users || [];
  const user = db.data.users.find(u => u.id === userId);
  if (user) {
    // Return a safe version of user (without password hash)
    const { hashedPassword, ...safeUser } = user; 
    return safeUser;
  }
  return null;
}

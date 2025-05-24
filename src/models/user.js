const bcrypt = require('bcrypt');
const jsonfile = require('jsonfile');
const { dbPath } = require('../db');

const SALT_ROUNDS = 10;

async function createUser(username, password, role, defaultPasswordChanged = true) {
  const data = await jsonfile.readFile(dbPath);
  const existingUser = data.users.find(u => u.username === username);
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
  
  data.users.push(user);
  await jsonfile.writeFile(dbPath, data, { spaces: 2 });
  
  const { hashedPassword: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

async function findUserByUsername(username) {
  const data = await jsonfile.readFile(dbPath);
  const user = data.users.find(u => u.username === username);
  return user; // This will be undefined if not found, which is fine
}

async function verifyPassword(plainPassword, hashedPassword) {
  // This function does not interact with the db file, so it remains unchanged.
  return bcrypt.compare(plainPassword, hashedPassword);
}

async function updateUserPassword(userId, newPassword) {
  const data = await jsonfile.readFile(dbPath);
  const userIndex = data.users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    throw new Error('User not found');
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const newHashedPassword = await bcrypt.hash(newPassword, salt);

  data.users[userIndex].hashedPassword = newHashedPassword;
  data.users[userIndex].defaultPasswordChanged = true;
  
  await jsonfile.writeFile(dbPath, data, { spaces: 2 });
  
  const { hashedPassword: _, ...updatedUser } = data.users[userIndex];
  return updatedUser;
}

async function findUserById(userId) {
  const data = await jsonfile.readFile(dbPath);
  const user = data.users.find(u => u.id === userId);
  if (user) {
    const { hashedPassword, ...safeUser } = user; 
    return safeUser;
  }
  return null;
}

module.exports = {
  createUser,
  findUserByUsername,
  verifyPassword,
  updateUserPassword,
  findUserById,
};

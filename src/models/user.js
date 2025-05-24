const bcrypt = require('bcrypt');
const { db } = require('../db'); // Assuming db.js exports { db, initializeDatabase }

const SALT_ROUNDS = 10;

async function createUser(username, password, role, defaultPasswordChanged = true) {
  await db.read(); // Ensure latest data for finding existing user
  const existingUser = db.get('users').find({ username: username }).value();
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
  
  await db.get('users').push(user).write();
  
  // Return user object without password for security
  const { hashedPassword: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

async function findUserByUsername(username) {
  await db.read(); // Ensure latest data
  const user = db.get('users').find({ username: username }).value();
  return user;
}

async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

async function updateUserPassword(userId, newPassword) {
  await db.read(); // Ensure latest data
  const userToUpdate = db.get('users').find({ id: userId });

  if (!userToUpdate.value()) {
    throw new Error('User not found');
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await userToUpdate.assign({ hashedPassword: hashedPassword, defaultPasswordChanged: true }).write();
  
  // Return a representation of the updated user (without password)
  const updatedUserFromDb = userToUpdate.value();
  const { hashedPassword: _, ...updatedUserSafe } = updatedUserFromDb;
  return updatedUserSafe;
}

async function findUserById(userId) {
  await db.read(); // Ensure latest data
  const user = db.get('users').find({ id: userId }).value();
  if (user) {
    // Return a safe version of user (without password hash)
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

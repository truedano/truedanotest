const { db } = require('../db');

async function createEvent(eventDetails) {
  await db.read();
  db.data.events = db.data.events || []; // Ensure events array exists

  let formattedCustomFields = [];
  if (eventDetails.customFieldLabels && Array.isArray(eventDetails.customFieldLabels)) {
    formattedCustomFields = eventDetails.customFieldLabels
      .filter(label => label && label.trim() !== "") // Ensure label is not empty
      .map((label, index) => ({
        id: `cf-${Date.now()}-${index}`, // Unique ID for the custom field
        label: label.trim(),
        type: 'text' // Default to text input for now
      }));
  }

  const newEvent = {
    id: Date.now().toString(), // Simple ID generation
    title: eventDetails.title,
    description: eventDetails.description,
    date: eventDetails.date,
    createdBy: eventDetails.createdBy, // Admin's user ID
    published: false,
    customFields: formattedCustomFields, // Store formatted custom fields
    attendees: [],
  };
  
  db.data.events.push(newEvent);
  await db.write();
  return newEvent;
}

async function getAllEvents() {
  await db.read();
  return db.data.events || [];
}

async function findEventById(eventId) {
  await db.read();
  // Ensure events array exists before trying to find
  db.data.events = db.data.events || [];
  return db.data.events.find(event => event.id === eventId);
}

async function updateEvent(eventId, dataToUpdate) {
  await db.read();
  db.data.events = db.data.events || [];
  const eventIndex = db.data.events.findIndex(event => event.id === eventId);
  if (eventIndex === -1) {
    throw new Error('Event not found');
  }
  db.data.events[eventIndex] = { ...db.data.events[eventIndex], ...dataToUpdate };
  await db.write();
  return db.data.events[eventIndex];
}

async function registerUserForEvent(eventId, userId, responses) {
  await db.read();
  // Ensure events array exists before trying to find
  db.data.events = db.data.events || [];
  const eventIndex = db.data.events.findIndex(event => event.id === eventId);
  if (eventIndex === -1) {
    throw new Error('Event not found');
  }

  const event = db.data.events[eventIndex];
  // Ensure attendees array exists
  event.attendees = event.attendees || [];
  const isAlreadyRegistered = event.attendees.some(attendee => attendee.userId === userId);

  if (isAlreadyRegistered) {
    throw new Error('User already registered for this event');
  }

  event.attendees.push({ userId: userId, responses: responses });
  await db.write(); // db.data.events[eventIndex] is already updated by reference
  return event; // Return the updated event
}

module.exports = {
  createEvent,
  getAllEvents,
  findEventById,
  updateEvent,
  registerUserForEvent,
};

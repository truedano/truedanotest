const { db } = require('../db');

async function createEvent(eventDetails) {
  await db.read(); // Ensure we have the latest state before writing
  // initializeDatabase in db.js should have already created db.data.events = []

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
  
  await db.get('events').push(newEvent).write(); // New way
  return newEvent;
}

async function getAllEvents() {
  await db.read(); // Optional: ensure latest data
  return db.get('events').value() || []; // Get all events
}

async function findEventById(eventId) {
  await db.read(); // Optional: ensure latest data
  const event = db.get('events').find({ id: eventId }).value();
  return event;
}

async function updateEvent(eventId, dataToUpdate) {
  await db.read(); // Optional: ensure latest data
  const eventToUpdate = db.get('events').find({ id: eventId });
  if (!eventToUpdate.value()) {
    throw new Error('Event not found');
  }
  await eventToUpdate.assign(dataToUpdate).write(); // New way
  return eventToUpdate.value(); // Return the modified event data
}

async function registerUserForEvent(eventId, userId, responses) {
  await db.read(); // Optional: ensure latest data
  const eventToUpdate = db.get('events').find({ id: eventId });
  if (!eventToUpdate.value()) {
    throw new Error('Event not found');
  }

  const eventData = eventToUpdate.value(); // Get current event data
  // Ensure attendees array exists on the fetched data (though initializeDatabase should handle the base)
  eventData.attendees = eventData.attendees || []; 
  const isAlreadyRegistered = eventData.attendees.some(attendee => attendee.userId === userId);

  if (isAlreadyRegistered) {
    throw new Error('User already registered for this event');
  }

  const updatedAttendees = [...eventData.attendees, { userId: userId, responses: responses }];
  await eventToUpdate.assign({ attendees: updatedAttendees }).write(); // New way
  return eventToUpdate.value(); // Return the modified event data
}

module.exports = {
  createEvent,
  getAllEvents,
  findEventById,
  updateEvent,
  registerUserForEvent,
};

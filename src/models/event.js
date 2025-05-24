const jsonfile = require('jsonfile');
const { dbPath } = require('../db');

async function createEvent(eventDetails) {
  const data = await jsonfile.readFile(dbPath);
  data.events = data.events || []; // Ensure events array exists

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
    customFields: formattedCustomFields,
    attendees: [],
  };
  
  data.events.push(newEvent);
  await jsonfile.writeFile(dbPath, data, { spaces: 2 });
  return newEvent;
}

async function getAllEvents() {
  const data = await jsonfile.readFile(dbPath);
  return data.events || [];
}

async function findEventById(eventId) {
  const data = await jsonfile.readFile(dbPath);
  // Ensure data.events exists before trying to find on it
  data.events = data.events || []; 
  const event = data.events.find(e => e.id === eventId);
  return event; // Will be undefined if not found
}

async function updateEvent(eventId, dataToUpdate) {
  const data = await jsonfile.readFile(dbPath);
  data.events = data.events || [];
  const eventIndex = data.events.findIndex(e => e.id === eventId);

  if (eventIndex === -1) {
    throw new Error('Event not found');
  }

  data.events[eventIndex] = { ...data.events[eventIndex], ...dataToUpdate };
  await jsonfile.writeFile(dbPath, data, { spaces: 2 });
  return data.events[eventIndex];
}

async function registerUserForEvent(eventId, userId, responses) {
  const data = await jsonfile.readFile(dbPath);
  data.events = data.events || [];
  const eventIndex = data.events.findIndex(e => e.id === eventId);

  if (eventIndex === -1) {
    throw new Error('Event not found');
  }

  const eventData = data.events[eventIndex];
  eventData.attendees = eventData.attendees || []; // Ensure attendees array exists

  const isAlreadyRegistered = eventData.attendees.some(attendee => attendee.userId === userId);
  if (isAlreadyRegistered) {
    throw new Error('User already registered for this event');
  }

  eventData.attendees.push({ userId: userId, responses: responses });
  // data.events[eventIndex] is already updated by reference to eventData
  await jsonfile.writeFile(dbPath, data, { spaces: 2 });
  return data.events[eventIndex]; // Return the updated event
}

module.exports = {
  createEvent,
  getAllEvents,
  findEventById,
  updateEvent,
  registerUserForEvent,
};

/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */

const path = require("path");

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: false,
});

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"), // Will be modified to use the instance
  },
});

// Register Handlebars helper for equality
const handlebars = require("handlebars");
handlebars.registerHelper('if_eq', function(a, b, opts) {
  if (a === b) {
    return opts.fn(this);
  } else {
    return opts.inverse(this);
  }
});

// Re-register view with the modified handlebars instance
// Note: This might need adjustment based on how fastify allows re-registering or modifying existing registrations.
// If direct modification isn't feasible, this should be done during initial registration.
// For this context, let's assume we can update the engine instance or it's done at setup.
// Correct approach is to configure this when fastify/view is first registered.
// Let's find the original registration and modify it.

// Session management
fastify.register(require('@fastify/cookie'));
fastify.register(require('@fastify/session'), {
  secret: process.env.SESSION_SECRET || 'a-very-long-and-random-secret-string-for-session-management', // Use environment variable in production
  cookie: {
    secure: false, // Set to true if using HTTPS
    // maxAge: 1000 * 60 * 60 * 24 // Optional: e.g., 1 day
  },
  saveUninitialized: false,
});

// At the top with other requires
const { initializeDatabase, db } = require("./src/db"); // Added db
const { createUser, findUserByUsername } = require('./src/models/user'); // Add this require

// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

/**
 * Our home page route
 *
 * Returns src/pages/index.hbs with data built into it
 */
fastify.get("/", function (request, reply) {
  // params is an object we'll pass to our handlebars template
  let params = { 
    seo: seo,
    user: request.session.user, // Add user session data
    needsPasswordChange: request.session.user && !request.session.user.defaultPasswordChanged // Add password change flag
  };

  // If someone clicked the option for a random color it'll be passed in the querystring
  if (request.query.randomize) {
    // We need to load our color data file, pick one at random, and add it to the params
    const colors = require("./src/colors.json");
    const allColors = Object.keys(colors);
    let currentColor = allColors[(allColors.length * Math.random()) << 0];

    // Add the color properties to the params object
    params = {
      color: colors[currentColor],
      colorError: null,
      seo: seo,
    };
  }

  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/index.hbs", params);
});

// Make sure findUserByUsername and verifyPassword are available for login routes
// And updateUserPassword for the change-password route
const { findUserByUsername, verifyPassword, updateUserPassword, createUser } = require('./src/models/user'); // Added createUser

// Define adminOnly preHandler (can be defined once and reused)
async function adminOnly(request, reply) {
  if (!request.session.user) {
    return reply.redirect('/login');
  }
  if (request.session.user.role !== 'admin') {
    // Or redirect to a specific 'unauthorized' page or just home
    reply.code(403); 
    return reply.send('Forbidden: Admins only'); 
  }
}

// Define loggedInOnly preHandler (can be defined once and reused)
async function loggedInOnly(request, reply) {
  if (!request.session.user) {
    return reply.redirect('/login');
  }
}

// Login GET route
fastify.get('/login', (request, reply) => {
  return reply.view('/src/pages/login.hbs', { seo: seo });
});

// Login POST route
fastify.post('/login', async (request, reply) => {
  const { username, password } = request.body;
  const user = await findUserByUsername(username);

  if (!user || !(await verifyPassword(password, user.hashedPassword))) {
    return reply.view('/src/pages/login.hbs', { error: 'Invalid username or password.', seo: seo });
  }

  request.session.user = { 
    id: user.id, 
    username: user.username, 
    role: user.role, 
    defaultPasswordChanged: user.defaultPasswordChanged 
  };
  
  // Redirect to change-password if default password hasn't been changed
  if (!user.defaultPasswordChanged) {
    return reply.redirect('/change-password'); // Or a dedicated page for this
  }

  return reply.redirect('/');
});

// Logout GET route
fastify.get('/logout', (request, reply) => {
  if (request.session) {
    request.session.destroy(err => {
      if (err) {
        reply.status(500).send('Could not log out.');
        return;
      }
      reply.redirect('/login');
    });
  } else {
    reply.redirect('/login');
  }
});

// Dashboard route (protected)
fastify.get('/dashboard', {
  preHandler: async (request, reply) => {
    if (!request.session.user) {
      return reply.redirect('/login');
    }
  }
}, async (request, reply) => {
  return reply.view('/src/pages/dashboard.hbs', { 
    user: request.session.user, 
    seo: seo // Assuming 'seo' is globally available or passed appropriately
  });
});

// Change Password GET route
fastify.get('/change-password', {
  preHandler: async (request, reply) => {
    if (!request.session.user) {
      return reply.redirect('/login');
    }
  }
}, (request, reply) => {
  return reply.view('/src/pages/change-password.hbs', { 
    seo: seo, 
    user: request.session.user 
  });
});

// Change Password POST route
fastify.post('/change-password', {
  preHandler: async (request, reply) => {
    if (!request.session.user) {
      return reply.redirect('/login');
    }
  }
}, async (request, reply) => {
  const { currentPassword, newPassword, confirmPassword } = request.body;
  const sessionUser = request.session.user;
  let params = { seo: seo, user: sessionUser };

  if (newPassword !== confirmPassword) {
    params.error = 'New passwords do not match.';
    return reply.view('/src/pages/change-password.hbs', params);
  }

  // Fetch the full user object to get the current hashed password
  const userFromDb = await findUserByUsername(sessionUser.username); 
  if (!userFromDb) {
    params.error = 'User not found.'; // Should not happen if session is valid
    return reply.view('/src/pages/change-password.hbs', params);
  }

  const isCurrentPasswordCorrect = await verifyPassword(currentPassword, userFromDb.hashedPassword);
  if (!isCurrentPasswordCorrect) {
    params.error = 'Incorrect current password.';
    return reply.view('/src/pages/change-password.hbs', params);
  }

  try {
    await updateUserPassword(sessionUser.id, newPassword);
    request.session.user.defaultPasswordChanged = true; // Update session
    params.success = 'Password changed successfully.';
  } catch (err) {
    console.error(err); // Log the actual error for server-side debugging
    params.error = 'An error occurred while changing password.';
  }
  return reply.view('/src/pages/change-password.hbs', params);
});

// Admin Create User GET route
fastify.get('/admin/create-user', { preHandler: adminOnly }, async (request, reply) => {
  return reply.view('/src/pages/admin/create-user.hbs', { seo: seo, user: request.session.user });
});

// Admin Create User POST route
fastify.post('/admin/create-user', { preHandler: adminOnly }, async (request, reply) => {
  const { username, password } = request.body;
  let params = { seo: seo, user: request.session.user };

  if (!username || !password) {
    params.error = 'Username and password are required.';
    return reply.view('/src/pages/admin/create-user.hbs', params);
  }

  try {
    // createUser is already required from './src/models/user'
    await createUser(username, password, 'user', false); // role 'user', defaultPasswordChanged false
    params.successMessage = `User '${username}' created successfully. Default password is '${password}'. Consider changing it.`;
  } catch (err) {
    console.error('Error creating user:', err);
    params.error = err.message || 'An error occurred while creating the user.';
  }
  return reply.view('/src/pages/admin/create-user.hbs', params);
});

// Require getAllEvents from event model
const { createEvent, getAllEvents, findEventById, updateEvent } = require('./src/models/event'); // Added getAllEvents, findEventById, updateEvent

// GET /admin/events
fastify.get('/admin/events', { preHandler: adminOnly }, async (request, reply) => {
  try {
    const events = await getAllEvents();
    return reply.view('/src/pages/admin/events.hbs', { 
      seo: seo, 
      user: request.session.user, 
      events: events 
    });
  } catch (err) {
    console.error("Error fetching events for admin:", err);
    // Render the page with an error or an empty list
    return reply.view('/src/pages/admin/events.hbs', { 
      seo: seo, 
      user: request.session.user, 
      events: [],
      error: "Could not load events."
    });
  }
});

// GET /admin/events/new
fastify.get('/admin/events/new', { preHandler: adminOnly }, async (request, reply) => {
  return reply.view('/src/pages/admin/create-event.hbs', { seo: seo, user: request.session.user });
});

// GET /events (for general users)
fastify.get('/events', { preHandler: loggedInOnly }, async (request, reply) => {
  try {
    const allEvents = await getAllEvents(); // getAllEvents is already required from src/models/event
    const publishedEvents = allEvents.filter(event => event.published);
    
    const userId = request.session.user.id;
    const eventsWithRegistrationStatus = publishedEvents.map(event => {
      // Ensure attendees array exists before checking
      const attendees = event.attendees || [];
      const isRegistered = attendees.some(attendee => attendee.userId === userId);
      return { ...event, isRegistered: isRegistered };
    });
    
    return reply.view('/src/pages/events.hbs', { 
      seo: seo, 
      user: request.session.user, 
      events: eventsWithRegistrationStatus, // Pass this modified list
      message: request.query.message, // For success/error messages
      error: request.query.error
    });
  } catch (err) {
    console.error("Error fetching events for user:", err);
    return reply.view('/src/pages/events.hbs', { 
      seo: seo, 
      user: request.session.user, 
      events: [],
      error: "Could not load events."
    });
  }
});

// POST /admin/events/new
// Note: createEvent is already imported above with getAllEvents etc.
fastify.post('/admin/events/new', { preHandler: adminOnly }, async (request, reply) => {
  const { title, description, date } = request.body;
  let customFieldLabels = request.body.customFieldLabels; // This could be an array or single string
  const adminId = request.session.user.id;
  let params = { seo: seo, user: request.session.user, data: request.body }; // Pass back form data

  if (!title || !description || !date) {
    params.error = 'Title, description, and date are required.';
    // Preserve custom fields if they were entered
    params.data.customFieldLabels = Array.isArray(customFieldLabels) ? customFieldLabels : (customFieldLabels ? [customFieldLabels] : []);
    return reply.view('/src/pages/admin/create-event.hbs', params);
  }

  // Ensure customFieldLabels is an array for the model
  if (customFieldLabels && !Array.isArray(customFieldLabels)) {
    customFieldLabels = [customFieldLabels];
  } else if (!customFieldLabels) {
    customFieldLabels = [];
  }
  
  // Filter out any empty strings that might come from empty fields
  customFieldLabels = customFieldLabels.filter(label => label && label.trim() !== "");

  try {
    const newEvent = await createEvent({ 
      title, 
      description, 
      date, 
      createdBy: adminId, 
      customFieldLabels 
    });
    params.successMessage = `Event '${newEvent.title}' created successfully with ${newEvent.customFields.length} custom field(s).`;
    // Clear form data on success
    params.data = { customFieldLabels: [] }; 
  } catch (err) {
    console.error('Error creating event:', err);
    params.error = 'An error occurred while creating the event.';
    // Preserve custom fields if they were entered
    params.data.customFieldLabels = customFieldLabels;
  }
  return reply.view('/src/pages/admin/create-event.hbs', params);
});

// POST /admin/events/:eventId/publish
fastify.post('/admin/events/:eventId/publish', { preHandler: adminOnly }, async (request, reply) => {
  const { eventId } = request.params;
  try {
    await updateEvent(eventId, { published: true });
  } catch (err) {
    console.error(`Error publishing event ${eventId}:`, err);
    // Optionally, pass an error message via session flash or query param
    // For now, we'll just log it. A more robust error handling might involve
    // setting a flash message in the session and displaying it on the /admin/events page.
  }
  return reply.redirect('/admin/events');
});

// POST /admin/events/:eventId/unpublish
fastify.post('/admin/events/:eventId/unpublish', { preHandler: adminOnly }, async (request, reply) => {
  const { eventId } = request.params;
  try {
    await updateEvent(eventId, { published: false });
  } catch (err) {
    console.error(`Error unpublishing event ${eventId}:`, err);
    // Similar error handling consideration as above
  }
  return reply.redirect('/admin/events');
});

// POST /events/:eventId/register
fastify.post('/events/:eventId/register', { preHandler: loggedInOnly }, async (request, reply) => {
  const { eventId } = request.params;
  const userId = request.session.user.id;

  try {
    const event = await findEventById(eventId); // findEventById is already required
    if (!event) {
      return reply.redirect('/events?error=' + encodeURIComponent('Event not found'));
    }

    let parsedResponses = [];
    if (event.customFields && event.customFields.length > 0) {
      parsedResponses = event.customFields.map(field => {
        const responseValue = request.body['custom_' + field.id] || ""; // Get response from body
        return {
          fieldId: field.id,
          label: field.label,
          value: responseValue
        };
      });
    }
    
    // registerUserForEvent is already required from src/models/event
    await registerUserForEvent(eventId, userId, parsedResponses);
    return reply.redirect('/events?message=' + encodeURIComponent('Successfully registered for the event!'));
  } catch (err) {
    console.error(`Error registering user ${userId} for event ${eventId}:`, err);
    // Check if the error message is "User already registered for this event"
    const errorMessage = (err.message === 'User already registered for this event') 
                         ? 'You are already registered for this event.'
                         : 'Failed to register for the event.';
    return reply.redirect('/events?error=' + encodeURIComponent(errorMessage));
  }
});

// GET /my-events
fastify.get('/my-events', { preHandler: loggedInOnly }, async (request, reply) => {
  const userId = request.session.user.id;
  let params = { seo: seo, user: request.session.user, registeredEvents: [] };

  try {
    const allEvents = await getAllEvents(); // getAllEvents is already required
    const eventsUserRegisteredFor = allEvents
      .filter(event => 
        event.attendees && event.attendees.some(attendee => attendee.userId === userId)
      )
      .map(event => {
        const userAttendeeData = event.attendees.find(attendee => attendee.userId === userId);
        return {
          ...event, // Spread the original event properties
          userResponses: userAttendeeData ? userAttendeeData.responses : [] // Add user's specific responses
        };
      });
    
    params.registeredEvents = eventsUserRegisteredFor;
  } catch (err) {
    console.error("Error fetching user's registered events:", err);
    params.error = "Could not load your registered events."; // This will be passed to the template
  }
  
  return reply.view('/src/pages/my-events.hbs', params);
});

// GET /admin/events/:eventId/attendees
// Note: findEventById is already imported from event model
// Note: findUserById is already imported from user model
fastify.get('/admin/events/:eventId/attendees', { preHandler: adminOnly }, async (request, reply) => {
  const { eventId } = request.params;
  let params = { seo: seo, user: request.session.user };

  try {
    const event = await findEventById(eventId);
    if (!event) {
      // Ideally, redirect to a 404 page or show an error
      // For simplicity, redirecting to admin events list with an error query
      return reply.redirect('/admin/events?error=' + encodeURIComponent('Event not found')); 
    }
    params.event = event;

    let attendeesWithUsernames = [];
    if (event.attendees && event.attendees.length > 0) {
      attendeesWithUsernames = await Promise.all(event.attendees.map(async (attendee) => {
        const userDetail = await findUserById(attendee.userId); // findUserById is already required
        return {
          username: userDetail ? userDetail.username : 'Unknown User',
          responses: attendee.responses || []
        };
      }));
    }
    params.attendeesWithUsernames = attendeesWithUsernames;

  } catch (err) {
    console.error(`Error fetching attendees for event ${eventId}:`, err);
    params.error = "Could not load event attendees.";
    // If event was found but fetching users failed, render page with error.
    // If event not found, the redirect above handles it.
    if (params.event) { // Check if event was loaded before error occurred
        return reply.view('/src/pages/admin/event-attendees.hbs', params);
    }
    // Fallback redirect if event itself was the issue and not caught by the first check (should be rare)
    return reply.redirect('/admin/events?error=' + encodeURIComponent('Error loading event details'));
  }
  
  return reply.view('/src/pages/admin/event-attendees.hbs', params);
});

/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */
fastify.post("/", function (request, reply) {
  // Build the params object to pass to the template
  let params = { seo: seo };

  // If the user submitted a color through the form it'll be passed here in the request body
  let color = request.body.color;

  // If it's not empty, let's try to find the color
  if (color) {
    // ADD CODE FROM TODO HERE TO SAVE SUBMITTED FAVORITES

    // Load our color data file
    const colors = require("./src/colors.json");

    // Take our form submission, remove whitespace, and convert to lowercase
    color = color.toLowerCase().replace(/\s/g, "");

    // Now we see if that color is a key in our colors object
    if (colors[color]) {
      // Found one!
      params = {
        color: colors[color],
        colorError: null,
        seo: seo,
      };
    } else {
      // No luck! Return the user value as the error property
      params = {
        colorError: request.body.color,
        seo: seo,
      };
    }
  }

  // The Handlebars template will use the parameter values to update the page with the chosen color
  return reply.view("/src/pages/index.hbs", params);
});

// Before fastify.listen
async function startServer() {
  try {
    await initializeDatabase(); // Initialize DB

    // Seed initial users
    await db.read(); // Ensure db.data is loaded before seeding
    if (!db.data.users) { // Should be initialized by initializeDatabase, but good practice
        db.data.users = [];
    }

    const adminUser = await findUserByUsername('admin');
    if (!adminUser) {
      console.log('Creating default admin user...');
      await createUser('admin', 'admin', 'admin', false);
    }

    const defaultUser = await findUserByUsername('user');
    if (!defaultUser) {
      console.log('Creating default general user...');
      await createUser('user', 'users', 'user', false);
    }

    await fastify.listen({ port: process.env.PORT, host: "0.0.0.0" });
    // Log listening address is handled by fastify's listen callback
  } catch (err) {
    // fastify.log.error(err); // Use fastify.log if available and configured, otherwise console.error
    console.error(err); // Use console.error as fastify.log might not be configured for errors
    process.exit(1);
  }
}

startServer();

// Run the server and report out to the logs
// The listen call is now within startServer, so this original call can be removed or commented out.
// fastify.listen(
//   { port: process.env.PORT, host: "0.0.0.0" },
//   function (err, address) {
//     if (err) {
//       console.error(err);
//       process.exit(1);
//     }
//     console.log(`Your app is listening on ${address}`);
//   }
// );

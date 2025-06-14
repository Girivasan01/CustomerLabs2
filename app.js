const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis'); 
const { Queue } = require('bullmq');
const { db } = require('./db');

const app = express();
const redis = new Redis({ maxRetriesPerRequest: null });
const queue = new Queue('webhookQueue', { connection: redis });

const SECRET = 'supersecret';
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));


app.use('/server/incoming_data', rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args)
  }),
  windowMs: 1000,
  max: 5,
  keyGenerator: req => req.headers['cl-x-token'] || req.ip,
  message: { success: false, message: 'Rate limit exceeded' }
}));


app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const stmt = db.prepare(`INSERT INTO users (email, password) VALUES (?, ?)`);
    const result = stmt.run(email, hashed);
    const role = db.prepare(`SELECT id FROM roles WHERE role_name = 'Admin'`).get();
    const roleId = role ? role.id : null;

    res.json({ success: true, user_id: result.lastInsertRowid, role_id: roleId });
  } catch {
    res.status(400).json({ success: false, message: 'Email already exists' });
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email }, SECRET);
  res.json({ success: true, token });
});


function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ success: false, message: 'Missing token' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}


app.post('/server/incoming_data', (req, res) => {
  const token = req.headers['cl-x-token'];
  const eventId = req.headers['cl-x-event-id'];

  if (!token || !eventId)
    return res.status(400).json({ success: false, message: 'Missing headers' });

  const account = db.prepare(`SELECT * FROM accounts WHERE app_secret_token = ?`).get(token);
  if (!account)
    return res.status(403).json({ success: false, message: 'Invalid token' });

  const destinations = db.prepare(`SELECT * FROM destinations WHERE account_id = ?`).all(account.account_id);
  const data = JSON.stringify(req.body);

  db.prepare(`
    INSERT INTO logs (event_id, account_id, received_data, status)
    VALUES (?, ?, ?, 'pending')
  `).run(eventId, account.account_id, data);

  destinations.forEach(dest => {
    queue.add('forward', {
      eventId,
      url: dest.url,
      method: dest.method,
      headers: JSON.parse(dest.headers),
      data
    });
  });

  res.json({ success: true, message: 'Data Received' });
});

app.post('/setup/account-with-destination', auth, (req, res) => {
  const {
    account_id,
    account_name,
    app_secret_token,
    website,
    destination_url,
    method,
    headers
  } = req.body;

  if (!account_id || !account_name || !app_secret_token || !destination_url || !method || !headers) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  try {
    db.prepare(`
      INSERT INTO accounts (account_id, account_name, app_secret_token, website, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(account_id, account_name, app_secret_token, website, req.user.id, req.user.id);

    db.prepare(`
      INSERT INTO destinations (account_id, url, method, headers, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(account_id, destination_url, method, JSON.stringify(headers), req.user.id, req.user.id);

    res.json({ success: true, message: 'Account and destination created' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

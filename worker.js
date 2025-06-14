
const { Worker } = require('bullmq');
const axios = require('axios');
const Redis = require('ioredis');
const { db } = require('./db');

const connection = new Redis({ maxRetriesPerRequest: null });

const worker = new Worker('webhookQueue', async job => {
  const { eventId, url, method, headers, data } = job.data;

  try {
    await axios({
      method,
      url,
      headers,
      data: JSON.parse(data)
    });

    db.prepare(`
      UPDATE logs
      SET processed_timestamp = datetime('now'), status = 'success'
      WHERE event_id = ?
    `).run(eventId);
  } catch (err) {
    db.prepare(`
      UPDATE logs
      SET processed_timestamp = datetime('now'), status = 'failed', error_message = ?
      WHERE event_id = ?
    `).run(err.message, eventId);
  }
}, { connection });

console.log('Worker is running...');

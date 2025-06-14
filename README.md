# CustomerLabs2

##  Data Pusher — Webhook Forwarder (Node.js)

This is a lightweight Node.js app that:

* Lets users **sign up / log in**
* Create **accounts** and webhook **destinations**
* Accepts **JSON data** and forwards it to your URLs in the background
* Uses **Redis + BullMQ** for queues and **SQLite** for storage

---

##  How to Run

### 1. Install dependencies

```bash
npm install
```

### 2. Start Redis (via Docker)

```bash
docker run -d --name redis-dev -p 6379:6379 redis
```

### 3. Start the app and worker

```bash
node app.js      # in one terminal
node worker.js   # in another
```

---

##  Basic Flow

1. **Signup** → `/signup`
2. **Login** → `/login` → get JWT token
3. **Create account + destination** → `/setup/account-with-destination` (needs token)
4. **Send data** → `/server/incoming_data` (needs headers)

---

##  Test with Postman or `api.http`
Use the included `api.http` file in VS Code with the **REST Client** extension.

---

##  That's It!

Just a clean webhook data forwarder that works out of the box.
Need help? I'm here! 

---


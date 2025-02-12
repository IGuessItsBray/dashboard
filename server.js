const express = require("express");
const session = require("express-session");
const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json'));
const { host, port, database, collection } = config.mongo;
const redirects = config.redirects;

const app = express();
const PORT = 3000;
const MONGO_URI = `mongodb://${host}:${port}`;
const DB_NAME = `${database}`; // Your database name
const COLLECTION_NAME = `${collection}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware
app.use(
    session({
        secret: "supersecretkey",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false } // Change to true if using HTTPS
    })
);

// Serve Static Files (HTML, CSS, JS, Images)
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
let db;
MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
    .then(client => {
        db = client.db(DB_NAME);
        console.log("Connected to MongoDB");
    })
    .catch(err => console.error("Failed to connect to MongoDB:", err));

// Fetch Usernames
app.get("/usernames", async (req, res) => {
    try {
        const users = await db.collection(COLLECTION_NAME).find({}, { projection: { _id: 0, username: 1, imageUrl: 1 } }).toArray();
        const usernames = users.map(user => ({ username: user.username, imageUrl: user.imageUrl }));
        res.json({ usernames });
    } catch (error) {
        console.error("Error fetching usernames:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to fetch redirect URLs
app.get('/redirects', (req, res) => {
    res.json(redirects);
});

// Login Route
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.collection(COLLECTION_NAME).findOne({ username, password });

        if (user) {
            req.session.user = username; // Store username in session
            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Invalid username or password" });
        }
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Dashboard Data Route (Fetch Logged-In User Info)
app.get("/dashboard-data", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const user = await db.collection(COLLECTION_NAME).findOne(
            { username: req.session.user },
            { projection: { _id: 0, username: 1, imageUrl: 1 } }
        );

        if (user) {
            res.json({ username: user.username, imageUrl: user.imageUrl || "placeholder.png" });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Logout Route
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// Serve Dashboard Page
app.get("/dashboard", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

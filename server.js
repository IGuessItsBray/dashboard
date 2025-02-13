const express = require("express");
const session = require("express-session");
const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const config = JSON.parse(fs.readFileSync("config.json"));
const { host, port, database, collection } = config.mongo;
const { user, pass } = config.ftp;
const redirects = config.redirects;
const FTPClient = require("ftp");

const app = express();
const PORT = 3000;
const MONGO_URI = `mongodb://${host}:${port}`;
const DB_NAME = `${database}`;
const COLLECTION_NAME = `${collection}`;

// FTP Server Configuration
const FTP_HOST = host; // Your Unraid FTP server IP
const FTP_USER = user; // Set this in your config.json or update here
const FTP_PASS = pass; // Set this in your config.json or update here

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Session Middleware
app.use(
    session({
        secret: "supersecretkey",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }
    })
);

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
        res.json({ usernames: users });
    } catch (error) {
        console.error("Error fetching usernames:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to fetch redirect URLs
app.get("/redirects", (req, res) => {
    res.json(redirects);
});

// Serve the dashboard
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Function to create FTP client connection
const connectFTP = () => {
    return new Promise((resolve, reject) => {
        const client = new FTPClient();
        client.on("ready", () => resolve(client));
        client.on("error", (err) => reject(err));
        client.connect({ host: FTP_HOST, user: FTP_USER, password: FTP_PASS });
    });
};

// List files from FTP
// List files from FTP
// List files from FTP
app.get("/files", async (req, res) => {
    const directory = req.query.path || "/mnt/user"; // Default to /mnt/user

    try {
        const client = await connectFTP();

        client.list(directory, (err, list) => {
            client.end();
            if (err) {
                console.error("FTP List Error:", err);
                return res.status(500).json({ error: "Failed to list files" });
            }

            const files = list.map(item => ({
                name: item.name,
                type: item.type === "d" ? "folder" : "file",
                icon: item.type === "d" ? "/images/folder.png" : "/images/file.png" // Add icon path
            }));

            res.json(files);
        });
    } catch (error) {
        console.error("FTP Connection Error:", error);
        res.status(500).json({ error: "FTP connection failed" });
    }
});



// Download file from FTP
app.get("/download", async (req, res) => {
    const filePath = req.query.path;
console.log(filePath)
    if (!filePath) {
        return res.status(400).json({ error: "Missing 'path' query parameter." });
    }

    try {
        const client = await connectFTP();
        
        client.get(filePath, (err, stream) => {
            if (err) {
                console.error("FTP Download Error:", err);
                client.end();
                return res.status(500).json({ error: "File download failed", details: err.message });
            }
            res.attachment(path.basename(filePath));
            stream.pipe(res);
            stream.on("end", () => client.end());
        });
        
    } catch (error) {
        console.error("FTP Connection Error:", error);
        res.status(500).json({ error: "FTP connection failed" });
    }
});

// Login Route
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.collection(COLLECTION_NAME).findOne({ username, password });
        if (user) {
            req.session.user = username;
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

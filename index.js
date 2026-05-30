const express = require('express');
const app = express();
const PORT = 3000;

// Middleware: This is crucial! It allows your server to read incoming JSON request bodies
app.use(express.json());

// Your local array acting as a temporary in-memory database
let users = [
    { id: 1, name: "Mohit", email: "mohit@example.com" },
    { id: 2, name: "Alex", email: "alex@example.com" }
];

// 1. GET ROUTE: Fetches and displays all users
app.get('/users', (req, res) => {
    res.status(200).json(users);
});

// 2. POST ROUTE: Receives data over the internet and adds a new user dynamically
app.post('/users', (req, res) => {
    const { name, email } = req.body;

    // Check if the user forgot to provide a name
    if (!name) {
        return res.status(400).json({ error: "Name field is completely required!" });
    }

    // Build the new user data structure
    const newUser = {
        id: users.length + 1,
        name: name,
        email: email || "No email provided"
    };

    // Save it directly into our array database
    users.push(newUser);

    // Send a successful response back to the sender
    res.status(201).json({
        message: "User successfully added over the tunnel!",
        user: newUser
    });
});

// Start listening for traffic
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Tunnel Traffic is successfully routing into port ${PORT}`);
});


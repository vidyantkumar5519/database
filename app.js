const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const Contact = require('./models/Contact');
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
const connectWithRetry = async () => {
    console.log('Attempting to connect to MongoDB...');
    try {
        // For production (like Render), use Atlas directly if MONGODB_URI isn't set
        const MONGODB_ATLAS_URI = 'mongodb+srv://vidyant:vidyant1234@cluster0.dw1lch9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        const connectionString = process.env.MONGODB_URI || (process.env.NODE_ENV === 'production' ? MONGODB_ATLAS_URI : 'mongodb://localhost:27017/vidyantTechnology');
        
        console.log('Connecting to MongoDB at: ' + connectionString.replace(/mongodb\+srv:\/\/([^:]+):[^@]+@/, 'mongodb+srv://$1:****@'));
        
        await mongoose.connect(connectionString, {
            serverSelectionTimeoutMS: 15000, // Timeout after 15 seconds instead of 30
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            // Remove deprecated options
        });
        console.log('Connected to MongoDB successfully');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    }
};

connectWithRetry();

// Handle contact form submissions
app.post('/api/contact', async (req, res) => {
    try {
        const contact = new Contact({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            phoneNumber: req.body.phoneNumber,
            subject: req.body.subject,
            message: req.body.message
        });

        await contact.save();
        res.status(201).json({ message: 'Contact form submitted successfully' });
    } catch (error) {
        console.error('Error saving contact:', error);
        res.status(500).json({ message: 'Error submitting contact form', error: error.message });
    }
});

// Serve static files (if needed)
app.use(express.static('public'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

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

// Global MongoDB connection status
let isConnected = false;

// Connect to MongoDB
const connectWithRetry = async () => {
    console.log('Attempting to connect to MongoDB...');
    try {
        // For production (like Render), use Atlas directly if MONGODB_URI isn't set
        // Note: You should set MONGO_USERNAME and MONGO_PASSWORD environment variables in Render
        const username = process.env.MONGO_USERNAME || 'vidyant';
        const password = process.env.MONGO_PASSWORD || 'WPwUVl5icdz11y2k
';
        const MONGODB_ATLAS_URI = `mongodb+srv://${username}:${password}@cluster0.dw1lch9.mongodb.net/vidyantTechnology?retryWrites=true&w=majority&appName=Cluster0`;
        const connectionString = process.env.MONGODB_URI || (process.env.NODE_ENV === 'production' ? MONGODB_ATLAS_URI : 'mongodb://localhost:27017/vidyantTechnology');
        
        console.log('Connecting to MongoDB at: ' + connectionString.replace(/mongodb\+srv:\/\/([^:]+):[^@]+@/, 'mongodb+srv://$1:****@'));
        
        if (mongoose.connection.readyState === 1) {
            console.log('Already connected to MongoDB');
            isConnected = true;
            return;
        }
        
        await mongoose.connect(connectionString, {
            serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
            socketTimeoutMS: 60000, // Increase socket timeout to 60 seconds
            connectTimeoutMS: 30000, // Connection timeout
            // Remove deprecated options
        });
        
        // Set up event listeners for MongoDB connection
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connection established successfully');
            isConnected = true;
        });
        
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            isConnected = false;
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB connection disconnected');
            isConnected = false;
            // Try to reconnect after a short delay
            setTimeout(connectWithRetry, 5000);
        });
        
        console.log('Connected to MongoDB successfully');
        isConnected = true;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        console.log('Retrying connection in 5 seconds...');
        isConnected = false;
        setTimeout(connectWithRetry, 5000);
    }
};

connectWithRetry();

// Handle contact form submissions
app.post('/api/contact', async (req, res) => {
    // Check if MongoDB is connected before proceeding
    if (!isConnected) {
        console.log('MongoDB connection not ready, waiting for connection...');
        // Wait a bit to see if connection establishes
        for (let i = 0; i < 5; i++) {
            if (isConnected) break;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }
        
        // If still not connected after waiting
        if (!isConnected) {
            return res.status(503).json({ 
                message: 'Database service unavailable', 
                error: 'Database connection not established. Please try again later.'
            });
        }
    }
    
    try {
        // Validate required fields
        const { firstName, lastName, email, message } = req.body;
        if (!firstName || !lastName || !email || !message) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        // Create new contact with timeout promise
        const contact = new Contact({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            phoneNumber: req.body.phoneNumber,
            subject: req.body.subject,
            message: req.body.message
        });

        // Set a timeout for the save operation
        const saveOperation = contact.save();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database operation timed out')), 15000)
        );
        
        // Wait for either the save to complete or the timeout to occur
        const result = await Promise.race([saveOperation, timeoutPromise]);
        
        console.log('Contact saved successfully:', result);
        res.status(201).json({ message: 'Contact form submitted successfully' });
    } catch (error) {
        console.error('Error saving contact:', error);
        
        // More descriptive error messages based on error type
        if (error.message === 'Database operation timed out') {
            return res.status(504).json({ 
                message: 'Error submitting contact form', 
                error: 'Operation timed out. Please try again later.'
            });
        }
        
        // Handle MongoDB-specific errors
        if (error.name === 'MongoServerError') {
            if (error.code === 11000) {
                return res.status(409).json({ 
                    message: 'Error submitting contact form', 
                    error: 'A contact with this email already exists'
                });
            }
        }
        
        // General error response
        res.status(500).json({ 
            message: 'Error submitting contact form', 
            error: error.message
        });
    }
});

// Serve static files (if needed)
app.use(express.static('public'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

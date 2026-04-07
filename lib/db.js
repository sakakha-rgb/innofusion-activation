// lib/db.js - Optimized for serverless
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

// Cache the connection for serverless performance
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!uri) {
    throw new Error('MONGODB_URI not set in environment variables');
  }

  try {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,           // Limit connections for serverless
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    const db = client.db('innofusion_licenses'); // Better database name
    
    cachedClient = client;
    cachedDb = db;
    
    console.log('MongoDB connected');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Graceful shutdown for serverless
process.on('SIGTERM', async () => {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
});

module.exports = { connectToDatabase };
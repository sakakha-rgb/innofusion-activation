const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

async function connectToDatabase() {
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  return client.db('innofusion_licenses');
}

module.exports = { connectToDatabase };
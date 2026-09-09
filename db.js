const { MongoClient } = require('mongodb');
const dns = require('dns');

const configuredDnsServers = (process.env.MONGO_DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);
const currentDnsServers = dns.getServers();
if (configuredDnsServers.length > 0) {
  dns.setServers(configuredDnsServers);
} else if (currentDnsServers.length > 0 && currentDnsServers.every((server) => server === '127.0.0.1' || server === '::1')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'velocityx';

let client;
let cachedDb;

async function connectToDatabase() {
  if (!uri) {
    throw new Error('Missing MONGO_URI in environment. Add it to .env or set it in your hosting environment.');
  }

  if (cachedDb) {
    return cachedDb;
  }

  client = new MongoClient(uri);
  await client.connect();
  cachedDb = client.db(dbName);
  return cachedDb;
}

async function getDb() {
  if (!cachedDb) {
    return connectToDatabase();
  }
  return cachedDb;
}

async function getCollection(name) {
  if (!uri) {
    throw new Error('Missing MONGO_URI in environment. Database operations are unavailable.');
  }
  const db = await getDb();
  return db.collection(name);
}

module.exports = {
  connectToDatabase,
  getDb,
  getCollection,
};

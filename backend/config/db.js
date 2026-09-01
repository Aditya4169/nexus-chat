const mongoose = require('mongoose');
const dns = require('dns').promises;
const { Resolver } = dns;

const getMongoSrvHostname = (mongoUri) => {
  try {
    const hostname = new URL(mongoUri).hostname;
    return hostname ? `_mongodb._tcp.${hostname}` : null;
  } catch (error) {
    console.error('[DNS DIAGNOSTIC] Could not parse MONGO_URI:', error.message);
    return null;
  }
};

const logSrvResolution = async (srvHostname) => {
  if (!srvHostname) {
    return;
  }

  console.log('[DNS DIAGNOSTIC] Node default DNS servers:', dns.getServers());

  try {
    const records = await dns.resolveSrv(srvHostname);
    console.log('[DNS DIAGNOSTIC] Default resolver SRV lookup succeeded:', records.map((record) => record.name));
  } catch (error) {
    console.error('[DNS DIAGNOSTIC] Default resolver SRV lookup failed:', error.code, error.message);
  }

  const googleResolver = new Resolver();
  googleResolver.setServers(['8.8.8.8']);

  try {
    const records = await googleResolver.resolveSrv(srvHostname);
    console.log('[DNS DIAGNOSTIC] Google DNS (8.8.8.8) SRV lookup succeeded:', records.map((record) => record.name));
  } catch (error) {
    console.error('[DNS DIAGNOSTIC] Google DNS (8.8.8.8) SRV lookup failed:', error.code, error.message);
  }
};

const explainMongoError = (error) => {
  const errorCode = error.code || error.name || 'UNKNOWN';
  const errorText = `${errorCode} ${error.message || ''}`.toLowerCase();

  if (errorText.includes('srv') || errorText.includes('dns') || ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEOUT'].includes(error.code)) {
    return 'The failure appears DNS-related. The configured resolver may be blocking SRV lookups; compare it with the Google DNS diagnostic above.';
  }

  if (errorText.includes('authentication') || errorCode === 18 || errorCode === '18') {
    return 'Authentication failed. Check the username and password in MONGO_URI, including URL encoding for special characters.';
  }

  if (errorText.includes('whitelist') || errorText.includes('ip access list') || errorCode === 8000 || errorCode === '8000') {
    return 'Atlas rejected the client network. Check Atlas Network Access and add this machine\'s IP address to the IP access list.';
  }

  return 'Check the full error above and verify the MongoDB URI, Atlas availability, network access, and credentials.';
};

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured. Add it to your .env file.');
  }

  await logSrvResolution(getMongoSrvHostname(mongoUri));

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('[MONGO CONNECT] Connection failed:', error.code || error.name || 'UNKNOWN', error.message);
    console.error('[MONGO CONNECT] Explanation:', explainMongoError(error));
    throw error;
  }
};

module.exports = connectDB;

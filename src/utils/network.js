// src/utils/network.js
const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Discord Bot' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function geocodeLocation(location) {
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;
    const geocodeData = await httpsGet(geocodeUrl);
    if (geocodeData.length === 0) {
        return null;
    }
    const { lat, lon, display_name } = geocodeData[0];
    return {
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        displayName: display_name,
    };
}

module.exports = { httpsGet, geocodeLocation };

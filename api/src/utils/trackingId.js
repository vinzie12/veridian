/**
 * Tracking ID Generator
 * Generates unique 8-character tracking IDs for incidents
 */

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a random 8-character tracking ID
 * @returns {string} 8-character alphanumeric ID
 */
const generateTrackingId = () => {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate a unique tracking ID, checking against existing IDs
 * @param {Function} checkExists - Async function that returns true if ID exists
 * @param {number} maxAttempts - Maximum attempts before giving up
 * @returns {Promise<string|null>} Unique tracking ID or null if failed
 */
const generateUniqueTrackingId = async (checkExists, maxAttempts = 10) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const trackingId = generateTrackingId();
    const exists = await checkExists(trackingId);
    
    if (!exists) {
      return trackingId;
    }
    attempts++;
  }
  
  return null;
};

module.exports = {
  generateTrackingId,
  generateUniqueTrackingId
};

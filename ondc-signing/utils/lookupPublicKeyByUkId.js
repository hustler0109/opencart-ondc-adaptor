// utils/registryLookup.js
import axios from 'axios';
import config from'./config.js';

export const lookupPublicKeyByUkId = async (ukId) => {
  try {
    const response = await axios.post(`${config.registryUrl}/lookup`, {
      subscriber_id: config.ondc.subscriberId,
      unique_key_id: ukId
    });

    const publicKey = response.data?.signing_public_key;
    return publicKey;
  } catch (error) {
    console.error('Error fetching public key from registry', error.message);
    return null;
  }
};

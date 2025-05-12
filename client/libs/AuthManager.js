import { API_URL } from '../config/config.js';
/**
 ** Attempts to refresh the authentication token
 * @returns {Promise<boolean>} - True if token refresh was successful, false otherwise
 */
export async function refreshAuthToken() {
  try {
    console.log("Attempting to refresh authentication token");
    
    const response = await fetch(API_URL+'/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error("Token refresh failed with status:", response.status);
      return false;
    }
    
    const data = await response.json();
    console.log("Token refresh successful for user:", data.user);
    return true;
    
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}

/**
 ** Checks if the current authentication is valid and refreshes token if needed
 * @returns {Promise<boolean>} - True if authenticated, false otherwise
 */
export async function verifyAuthentication() {
  try {
    const response = await fetch(API_URL+'/api/verify', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      return true;
    }
    return await refreshAuthToken();
    
  } catch (error) {
    console.error("Authentication verification error:", error);
    return false;
  }
}

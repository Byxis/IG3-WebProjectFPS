import { connectWebSocket } from "../libs/WebSocketManager.js";
import { startNetworkSyncInterval } from "../libs/NetworkSynchronizer.js";
import { ErrorTypes } from "../enum/ErrorTypes.js";
import { refreshAuthToken } from "../libs/AuthManager.js";

// Initialize application
initializeApp();

async function initializeApp() {
  try {
    await checkAuth();
    connectWebSocket();
    startNetworkSyncInterval();
  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
}

async function checkAuth() {
  try {
    const response = await fetch('https://localhost:3000/api/verify', {
      method: 'GET',
      credentials: 'include'
    });
    
    console.log("Auth check response status:", response.status);
    
    if (!response.ok) {
      // Auth verification failed, try to refresh the token
      console.log("Authentication check failed, attempting to refresh token");
      const refreshed = await refreshAuthToken();
      
      if (!refreshed) {
        console.log("Token refresh failed, redirecting to login");
        window.location.href = `login?error=${ErrorTypes.AUTH_FAILED}`;
        return false;
      }
      
      console.log("Token refreshed successfully");
      return true;
    }
    
    console.log("Authentication verified successfully");
    return true;
  } catch (error) {
    console.error('Authentication verification error:', error);
    window.location.href = `error?type=${ErrorTypes.SERVER_UNREACHABLE}&from=auth_check`;
    return false;
  }
}

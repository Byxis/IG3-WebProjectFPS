import { connectWebSocket } from "../libs/WebSocketManager.js";
import { startNetworkSyncInterval } from "../libs/NetworkSynchronizer.js";
import { ErrorTypes } from "../enum/ErrorTypes.js";
import { refreshAuthToken } from "../libs/AuthManager.js";
import { API_URL } from "../config/config.js";

initializeApp();
/**
 ** Initializes the application
 */

async function initializeApp() {
  try {
    await checkAuth();
    connectWebSocket();
    startNetworkSyncInterval();
  } catch (error) {
    console.error("Failed to initialize application:", error);
  }
}

/**
 ** Verifies user authentication status
 * Attempts to refresh token if needed
 * @returns {Promise<boolean>} Authentication status
 */
async function checkAuth() {
  try {
    const response = await fetch(`${API_URL}/api/verify`, {
      method: "GET",
      credentials: "include",
    });

    console.log("Auth check response status:", response.status);

    if (!response.ok) {
      console.log("Authentication check failed, attempting to refresh token");
      const refreshed = await refreshAuthToken();

      if (!refreshed) {
        console.log("Token refresh failed, redirecting to login");
        globalThis.location.href = `login?error=${ErrorTypes.AUTH_FAILED}`;
        return false;
      }

      console.log("Token refreshed successfully");
      return true;
    }

    console.log("Authentication verified successfully");
    return true;
  } catch (error) {
    console.error("Authentication verification error:", error);
    globalThis.location.href =
      `error?type=${ErrorTypes.SERVER_UNREACHABLE}&from=auth_check`;
    return false;
  }
}

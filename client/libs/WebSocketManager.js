import uiManager from "./UIManager.js";
import sceneManager from "./SceneManager.js";
import { API_URL, WSS_URL } from "../config/config.js";
import { synchronizeClockWithServer } from "./NetworkSynchronizer.js";
import { MessageTypeEnum } from "https://localhost:3000/shared/MessageTypeEnum.js";
import { ErrorTypes } from "../enum/ErrorTypes.js";
import { verifyAuthentication } from "./AuthManager.js";
import game from "./Game.js";

let wsocket = null;
let reconnectTimer = null;

const MAX_RECONNECTION_ATTEMPTS = 10;
const RECONNECTION_DELAY = 1000; // 1 second

export const wsState = {
  isConnected: false,
  isConnecting: false,
  hasError: false,
  errorReason: "",
  reconnectAttempts: 0,
};

/**
 ** Returns the current WebSocket instance.
 * @returns {WebSocket|null} The current WebSocket connection or null if not established.
 */
export function getWebSocket() {
  return wsocket;
}

/**
 ** Establishes a WebSocket connection to the server.
 * Verifies authentication before connecting and handles connection errors.
 * @returns {Promise<void>}
 */
export async function connectWebSocket() {
  if (wsState.isConnecting) {
    return;
  }

  if (
    wsocket &&
    (wsocket.readyState === WebSocket.CONNECTING ||
      wsocket.readyState === WebSocket.OPEN)
  ) {
    return;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  wsState.isConnecting = true;

  if (wsState.reconnectAttempts > 0) {
    uiManager.showConnectionStatus(
      `Reconnecting... Attempt ${wsState.reconnectAttempts}`,
    );
  } else {
    uiManager.showConnectionStatus("Establishing connection...");
  }

  try {
    // Verify authentication before connecting
    const isAuthenticated = await verifyAuthentication();

    if (!isAuthenticated) {
      console.log(
        "Authentication failed, cannot establish WebSocket connection",
      );
      wsState.isConnecting = false;
      wsState.hasError = true;
      wsState.errorReason = "Authentication failed";
      uiManager.showConnectionError(
        "Authentication failed. Refreshing page...",
      );
      // Redirect to login after a short delay
      setTimeout(() => {
        globalThis.location.href = `login?error=${ErrorTypes.AUTH_FAILED}`;
      }, 2000);
      return;
    }

    wsocket = new WebSocket(`${WSS_URL}/ws`);
    setupWebSocketHandlers();
  } catch (error) {
    wsState.isConnecting = false;
    wsState.hasError = true;
    wsState.errorReason = `Failed to create WebSocket: ${error.message}`;
    uiManager.showConnectionError(`Connection failed: ${error.message}`);
    attemptReconnection();
  }
}

/**
 ** Sets up event handlers for the WebSocket connection.
 * Handles connection open, close, error events and incoming messages.
 * @returns {void}
 */
function setupWebSocketHandlers() {
  wsocket.onopen = function () {
    console.log("WebSocket connection established");
    wsState.isConnected = true;
    wsState.isConnecting = false;
    wsState.hasError = false;
    wsState.errorReason = "";

    wsState.reconnectAttempts = 0;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    hideConnectionError();

    game.start();

    setTimeout(() => {
      if (wsocket && wsocket.readyState === WebSocket.OPEN) {
        wsocket.send(JSON.stringify({
          type: MessageTypeEnum.ADD_NEW_PLAYER,
          player: {
            name: localStorage.getItem("username"),
            position: { x: 0, y: 0, z: 5 },
            rotation: { x: 0, y: 0, z: 0 },
            pitch: 0,
          },
        }));

        wsocket.send(JSON.stringify({
          type: MessageTypeEnum.GET_CHAT_MESSAGES,
        }));
      }
    }, 500);

    synchronizeClockWithServer();
  };

  wsocket.onclose = function () {
    wsState.isConnected = false;
    wsState.isConnecting = false;

    showConnectionError(`Connection lost`);

    attemptReconnection();
  };

  wsocket.onerror = function () {
    console.error("WebSocket error occurred");
    wsState.isConnected = false;
    wsState.isConnecting = false;
    wsState.hasError = true;
    wsState.errorReason = "Connection error";
  };

  wsocket.onmessage = handleWebSocketMessage;
}

/**
 ** Attempts to reconnect to the WebSocket server after connection failure.
 * Implements backoff strategy and refreshes auth token on certain attempts.
 * @returns {void}
 */
async function attemptReconnection() {
  wsState.reconnectAttempts++;

  if (wsState.reconnectAttempts <= MAX_RECONNECTION_ATTEMPTS) {
    const message = `Reconnecting... Attempt ${wsState.reconnectAttempts}`;

    updateReconnectionStatus(message);

    if (wsState.reconnectAttempts % 2 === 0) { // Every second attempt
      try {
        await refreshAuthToken();
      } catch (_e) {
        console.log("Failed to refresh token during reconnection attempt");
      }
    }

    setTimeout(() => {
      connectWebSocket();
    }, RECONNECTION_DELAY);
  } else {
    globalThis.location.href =
      `error.html?type=${ErrorTypes.CONNECTION_ERROR}&attempts=${wsState.reconnectAttempts}&from=game`;
  }
}

/**
 ** Displays a connection error message to the user.
 * @param {string} message - The error message to display.
 * @returns {void}
 */
function showConnectionError(message) {
  const errorElement = document.getElementById("connection-error");
  const errorTextElement = document.getElementById("connection-error-text");

  if (errorElement && errorTextElement) {
    errorTextElement.textContent = message;
    errorElement.style.display = "flex";
    // Add error class for red border
    errorElement.classList.add("error");
  }
}

/**
 ** Updates the reconnection status message displayed to the user.
 * @param {string} message - The status message to display.
 * @param {boolean} isError - Whether to display the message as an error.
 * @returns {void}
 */
function updateReconnectionStatus(message, isError = false) {
  const errorElement = document.getElementById("connection-error");
  const errorTextElement = document.getElementById("connection-error-text");

  if (errorElement && errorTextElement) {
    errorTextElement.textContent = message;
    errorElement.style.display = "flex";

    // Toggle error class based on isError parameter
    if (isError) {
      errorElement.classList.add("error");
    } else {
      errorElement.classList.remove("error");
    }
  }
}

/**
 ** Hides the connection error message and resets reconnection attempts.
 * @returns {void}
 */
export function hideConnectionError() {
  const errorElement = document.getElementById("connection-error");
  if (errorElement) {
    errorElement.style.display = "none";
    wsState.reconnectAttempts = 0;
  }
}

/**
 ** Processes incoming WebSocket messages based on message type.
 * Dispatches messages to appropriate handlers for player updates, chat, and system commands.
 * @param {MessageEvent} event - The WebSocket message event.
 * @returns {void}
 */
function handleWebSocketMessage(event) {
  try {
    const data = JSON.parse(event.data);
    const player = data.player;

    switch (data.type) {
      case MessageTypeEnum.NEW_PLAYER: {
        if (
          player && player.name &&
          game.players[player.name] != null
        ) {
          return;
        }
        if (player) {
          game.addNewPlayer(
            player.name,
            player.position,
            player.pitch,
          );
        }
        break;
      }

      case MessageTypeEnum.REMOVE_PLAYER: {
        if (player) {
          game.removePlayer(player.name);
        }
        break;
      }

      case MessageTypeEnum.UPDATE_PLAYER: {
        if (player) {
          game.updatePlayerPosition(
            player.name,
            player.position,
            player.rotation,
            player.pitch,
          );
        }
        break;
      }

      case MessageTypeEnum.POSITION_CORRECTION: {
        const correctedPosition = data.position;
        if (correctedPosition && sceneManager.cameraContainer) {
          sceneManager.cameraContainer.position.x = correctedPosition.x;
          sceneManager.cameraContainer.position.y = correctedPosition.y;
          sceneManager.cameraContainer.position.z = correctedPosition.z;
          console.log("Position corrected by server");
        }
        break;
      }

      case MessageTypeEnum.SEND_CHAT_MESSAGE: {
        const name = data.name;
        const message = data.message;
        const role = data.role;
        uiManager.addNewChatMessage(name, role, message);
        break;
      }

      case MessageTypeEnum.GET_CHAT_MESSAGES: {
        const messages = data.messages;
        if (Array.isArray(messages)) {
          messages.forEach((message) => {
            uiManager.addNewChatMessage(
              message.name,
              message.role,
              message.message,
            );
          });
        } else {
          console.error("Invalid messages format:", messages);
        }
        break;
      }

      case MessageTypeEnum.LOGOUT_COMMAND: {
        console.log("Received LOGOUT_COMMAND message");
        handleLogout();
        break;
      }

      case MessageTypeEnum.HEALTH_UPDATE: {
        if (data.health !== undefined) {
          uiManager.updateHealth(data.health);
        }
        break;
      }

      case MessageTypeEnum.DEATH_EVENT: {
        if (data.player) {
          game.handlePlayerDeath(data.player);
        }
        break;
      }

      case MessageTypeEnum.RESPAWN_EVENT: {
        if (data.player) {
          game.handlePlayerRespawn(data.player);
        }
        break;
      }

      default: {
        console.log("Message type not recognized:", data.type);
        break;
      }
    }
  } catch (error) {
    console.error(
      "Error processing WebSocket message:",
      error,
      "Raw message:",
      event.data,
    );
  }
}

/**
 ** Handles user logout by sending a request to the server and redirecting to login page.
 * Clears local storage credentials and handles errors during logout process.
 * @returns {void}
 */
function handleLogout() {
  fetch(`${API_URL}/logout`, {
    method: "POST",
    credentials: "include",
  })
    .then((response) => {
      if (response.ok) {
        console.log("Logout successful");
        localStorage.removeItem("username");
        globalThis.location.href = "login";
      } else {
        console.error("Logout error:", response.statusText);
        alert("Logout failed. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Logout error:", error);
      alert("Server connection error. Please try again later.");
    });
}

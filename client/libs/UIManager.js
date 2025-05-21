import { GAMESTATE } from "https://localhost:3000/shared/Config.js";
import { getWebSocket } from "./WebSocketManager.js";
import sceneManager from "./SceneManager.js";
import { MessageTypeEnum } from "https://localhost:3000/shared/MessageTypeEnum.js";

export class UIManager {
  /**
   ** Initializes the user interface manager.
   * Sets up chat interface, connection status elements, and creates UI containers.
   */
  constructor() {
    this.chatbox = document.getElementById("chatbox");
    this.chatboxMessages = document.getElementById("chatbox-messages");
    this.chatboxInput = document.getElementById("chatbox-input");
    this.chatboxSend = document.getElementById("chatbox-send");
    this.isChatboxActive = false;
    this.devMode = false;

    // Connection status UI elements
    this.connectionError = document.getElementById("connection-error");
    this.connectionErrorText = document.getElementById("connection-error-text");

    // Create UI container for display elements
    this.createUIContainer();
    this.initDamageOverlay();
    this.setupListeners();

    this.isPlayerDead = false;
    this.respawnTimer = null;
    this.damageOverlay = null;
  }

  /**
   ** Creates and configures the UI container for display elements.
   * Sets up position, FPS, and network debug displays with appropriate styling.
   * @returns {void}
   */
  createUIContainer() {
    // Check if container already exists
    let uiContainer = document.getElementById("ui-container");
    if (!uiContainer) {
      uiContainer = document.createElement("div");
      uiContainer.id = "ui-container";
      uiContainer.style.position = "fixed";
      uiContainer.style.top = "10px";
      uiContainer.style.left = "10px";
      uiContainer.style.color = "white";
      uiContainer.style.fontFamily = "monospace";
      uiContainer.style.fontSize = "14px";
      uiContainer.style.textShadow = "1px 1px 2px black";
      uiContainer.style.zIndex = "1000";
      document.body.appendChild(uiContainer);

      // Create position display
      const positionDiv = document.createElement("div");
      positionDiv.id = "position-display";
      uiContainer.appendChild(positionDiv);

      // Create FPS display (initially hidden)
      const fpsDiv = document.createElement("div");
      fpsDiv.id = "fps";
      fpsDiv.style.display = "none";
      uiContainer.appendChild(fpsDiv);

      // Create net-debug display (initially hidden)
      const netDebugDiv = document.createElement("div");
      netDebugDiv.id = "net-debug";
      netDebugDiv.style.display = "none";
      uiContainer.appendChild(netDebugDiv);
    }
  }

  /**
   ** Sets up event listeners for user interaction with the game.
   * Handles pointer lock, keyboard inputs, chat interactions, and window resizing.
   * @returns {void}
   */
  setupListeners() {
    sceneManager.renderer.domElement.addEventListener("click", () => {
      if (!this.isChatboxActive) {
        sceneManager.renderer.domElement.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      if (
        document.pointerLockElement === sceneManager.renderer.domElement &&
        !this.isChatboxActive
      ) {
        document.addEventListener(
          "mousemove",
          sceneManager.boundHandleMouseMove,
        );
      } else {
        document.removeEventListener(
          "mousemove",
          sceneManager.boundHandleMouseMove,
        );
      }
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.code in GAMESTATE.keyStates &&
        document.pointerLockElement === sceneManager.renderer.domElement
      ) {
        GAMESTATE.keyStates[event.code] = true;
        event.preventDefault();
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.code in GAMESTATE.keyStates) {
        GAMESTATE.keyStates[event.code] = false;
        event.preventDefault();
      }
    });

    this.chatboxSend.addEventListener("click", (event) => {
      event.preventDefault();
      const websocket = getWebSocket();
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        const message = this.chatboxInput.value;
        websocket.send(JSON.stringify({
          type: MessageTypeEnum.SEND_CHAT_MESSAGE,
          name: localStorage.getItem("username"),
          message: message,
        }));
      }
      this.chatboxInput.value = "";
      this.chatboxInput.focus();
    });

    document.addEventListener("keydown", (event) => {
      if (event.code === "Enter") {
        if (!this.isChatboxActive) {
          document.exitPointerLock();
          this.chatbox.style.opacity = 1;
          this.chatboxInput.focus();
          this.isChatboxActive = true;
        } else {
          if (this.chatboxInput.value.length > 0) {
            this.chatboxSend.click();
          } else {
            this.chatboxInput.blur();
            this.isChatboxActive = false;
            setTimeout(() => {
              if (!this.isChatboxActive) {
                this.chatbox.style.opacity = 0.5;
              }
            }, 3000);
            setTimeout(() => {
              sceneManager.renderer.domElement.requestPointerLock();
            }, 100);
          }
        }
      }

      if (event.code === "Escape") {
        if (this.isChatboxActive) {
          this.chatboxInput.blur();
          this.isChatboxActive = false;
          setTimeout(() => {
            if (!this.isChatboxActive) {
              this.chatbox.style.opacity = 0.5;
            }
          }, 3000);
          setTimeout(() => {
            sceneManager.renderer.domElement.requestPointerLock();
          }, 100);
        } else {
          document.exitPointerLock();
        }
      }

      // toggle dev mode
      if (event.ctrlKey && event.code === "KeyP") {
        event.preventDefault();
        this.toggleDevMode();
      }
    });

    globalThis.addEventListener("resize", () => this.handleResize());
  }

  /**
   ** Toggles developer mode to show/hide additional debugging information.
   * Updates visibility of FPS and network debug elements based on dev mode status.
   * @returns {void}
   */
  toggleDevMode() {
    this.devMode = !this.devMode;

    // Update UI elements visibility
    const fpsElement = document.getElementById("fps");
    const netDebugElement = document.getElementById("net-debug");

    if (this.devMode) {
      fpsElement.style.display = "block";
      netDebugElement.style.display = "block";
    } else {
      fpsElement.style.display = "none";
      netDebugElement.style.display = "none";
    }

    console.log(`Dev mode ${this.devMode ? "enabled" : "disabled"}`);
  }

  /**
   ** Updates the position display in the UI.
   * Shows detailed or simplified position based on dev mode status.
   * @param {THREE.Vector3} position - The position to display.
   * @returns {void}
   */
  updatePosition(position) {
    const positionDisplay = document.getElementById("position-display");
    if (this.devMode) {
      positionDisplay.innerText = `X: ${position.x.toFixed(4)} Y: ${
        position.y.toFixed(4)
      } Z: ${position.z.toFixed(4)}`;
    } else {
      positionDisplay.innerText = `Position: (${position.x.toFixed(1)}, ${
        position.y.toFixed(1)
      }, ${position.z.toFixed(1)})`;
    }
  }

  /**
   ** Updates the FPS counter in the UI when in dev mode.
   * @param {number} fps - The current frames per second.
   * @returns {void}
   */
  updateFPS(fps) {
    if (this.devMode) {
      const fpsElement = document.getElementById("fps");
      fpsElement.innerText = `FPS: ${fps}`;
    }
  }

  /**
   ** Updates the network time offset display in dev mode.
   * @param {number} offset - The network time offset in milliseconds.
   * @returns {void}
   */
  updateNetworkOffset(offset) {
    if (this.devMode) {
      const netDebugElement = document.getElementById("net-debug");
      netDebugElement.innerText = `Offset: ${offset.toFixed(2)}ms`;
    }
  }

  /**
   ** Handles window resize events by updating camera and renderer dimensions.
   * @returns {void}
   */
  handleResize() {
    sceneManager.camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    sceneManager.camera.updateProjectionMatrix();
    sceneManager.renderer.setSize(
      globalThis.innerWidth,
      globalThis.innerHeight,
    );
  }

  /**
   ** Adds a new message to the in-game chat box.
   * Applies different styling based on user role and handles special system messages.
   * @param {string} name - The sender's name.
   * @param {number} role - The sender's role level (3=admin, 2=mod, 1=user).
   * @param {string} message - The message content, can include HTML for system messages.
   * @returns {void}
   */
  addNewChatMessage(name, role, message) {
    const chatMessage = document.createElement("p");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = name;

    if (role === 3) {
      nameSpan.style.color = "#ff4444";
    } else if (role === 2) {
      nameSpan.style.color = "#ffff44";
    } else {
      nameSpan.style.color = "#ffffff";
    }

    chatMessage.appendChild(nameSpan);

    if (name === "System") {
      const messageLines = message.split("<br>");

      chatMessage.appendChild(document.createTextNode(": " + messageLines[0]));

      for (let i = 1; i < messageLines.length; i++) {
        chatMessage.appendChild(document.createElement("br"));
        chatMessage.appendChild(document.createTextNode(messageLines[i]));
      }
    } else {
      chatMessage.appendChild(document.createTextNode(": " + message));
    }

    this.chatboxMessages.appendChild(chatMessage);
    this.chatbox.scrollTop = this.chatbox.scrollHeight;

    setTimeout(() => {
      this.chatboxMessages.scrollTop = this.chatboxMessages.scrollHeight;
      this.chatbox.scrollTop = this.chatbox.scrollHeight;
    }, 10);
  }

  /**
   ** Displays connection status information to the user.
   * @param {string} message - The status message to display.
   * @returns {void}
   */
  showConnectionStatus(message) {
    this.connectionErrorText.textContent = message;
    this.connectionError.classList.add("visible");
  }

  /**
   ** Displays a connection error message with error styling.
   * @param {string} message - The error message to display.
   * @returns {void}
   */
  showConnectionError(message) {
    this.connectionErrorText.textContent = message;
    this.connectionError.classList.add("visible", "error");
  }

  /**
   ** Hides the connection error/status message.
   * @returns {void}
   */
  hideConnectionError() {
    this.connectionError.classList.remove("visible", "error");
  }

  /**
   ** Initializes the damage overlay element for health visual effects
   * @returns {void}
   */
  initDamageOverlay() {
    if (!this.damageOverlay) {
      this.damageOverlay = document.querySelector(".damage-overlay");
      if (!this.damageOverlay) {
        console.warn("Damage overlay element not found");
        this.createDamageOverlay();
      }
    }
  }

  /**
   ** Creates the damage overlay element if it doesn't exist
   * @returns {void}
   */
  createDamageOverlay() {
    this.damageOverlay = document.createElement("div");
    this.damageOverlay.className = "damage-overlay";
    document.body.appendChild(this.damageOverlay);
  }

  /**
   ** Updates the health visual effect based on current health
   * @param {number} health - Current health value
   * @param {boolean} damageReceived - Whether damage was just received
   * @returns {void}
   */
  updateHealthEffect(health, damageReceived = false) {
    this.initDamageOverlay();
    if (!this.damageOverlay) return;

    const healthTier = Math.floor(health / 10) * 10;
    const newHealthClass = `health-${healthTier}`;

    document.body.classList.forEach((cls) => {
      if (cls.startsWith("health-") && cls !== newHealthClass) {
        document.body.classList.remove(cls);
      }
    });

    if (health <= 90 && !document.body.classList.contains(newHealthClass)) {
      document.body.classList.add(newHealthClass);
    }

    if (damageReceived) {
      if (!this.damageOverlay.classList.contains("active")) {
        this.damageOverlay.classList.add("active");

        setTimeout(() => {
          this.damageOverlay.classList.remove("active");
        }, 500);
      }
    }
  }

  /**
   ** Updates the health bar display
   * @param {number} health - The player's current health
   * @param {boolean} damageReceived - Whether damage was just received
   */
  updateHealth(health, damageReceived = false) {
    const lives = document.getElementById("lives");

    if (lives) {
      const healthPercent = Math.max(0, Math.min(100, health));

      let heartsText = "";
      const fullHearts = Math.floor(healthPercent / 25);

      for (let i = 0; i < fullHearts; i++) {
        heartsText += "❤️";
      }

      lives.innerHTML = `${heartsText} ${healthPercent}`;

      if (healthPercent <= 25) {
        lives.style.color = "#ff4655";
      } else if (healthPercent <= 50) {
        lives.style.color = "#ff9800";
      } else {
        lives.style.color = "white";
      }
    }

    this.updateHealthEffect(health, damageReceived);
  }

  /**
   ** Updates the ammo display
   * @param {number} ammo - Current ammo count
   * @param {number} maxAmmo - Maximum ammo capacity
   */
  updateAmmo(ammo, maxAmmo) {
    const ammosDisplay = document.getElementById("ammos");

    if (ammosDisplay) {
      ammosDisplay.textContent = `${ammo}/${maxAmmo}`;

      // Visual indication when low on ammo
      if (ammo === 0) {
        ammosDisplay.style.color = "#ff4655";
      } else if (ammo <= maxAmmo * 0.5) {
        ammosDisplay.style.color = "#ff9800";
      } else {
        ammosDisplay.style.color = "white";
      }
    }
  }

  /**
   ** Starts the reload animation
   * @param {number} duration - Reload duration in milliseconds
   * @returns {void}
   */
  startReloadAnimation(duration) {
    const ammoElement = document.getElementById("ammos");
    if (ammoElement) {
      ammoElement.classList.add("reloading");
      document.documentElement.style.setProperty(
        "--reload-duration",
        `${duration}ms`,
      );
    }
  }

  /**
   ** Updates reload progress (for manual progress updates)
   * @param {number} progress - Progress from 0 to 1
   */
  updateReloadProgress(progress) {
    const ammoElement = document.getElementById("ammos");
    if (ammoElement && ammoElement.classList.contains("reloading")) {
      ammoElement.style.setProperty("--reload-progress", `${progress * 100}%`);
    }
  }

  /**
   ** Completes the reload animation
   */
  completeReloadAnimation() {
    const ammoElement = document.getElementById("ammos");
    if (ammoElement) {
      ammoElement.style.setProperty("--reload-progress", "100%");
      setTimeout(() => {
        ammoElement.classList.remove("reloading");
        ammoElement.style.removeProperty("--reload-progress");
      }, 200);
    }
  }

  /**
   ** Shows the death overlay and starts the respawn timer
   * @param {number} respawnTime - Time in seconds until respawn
   */
  showDeathOverlay(respawnTime = 3) {
    this.isPlayerDead = true;

    const deathOverlay = document.getElementById("death-overlay");
    const respawnTimer = document.getElementById("respawn-timer");

    if (deathOverlay) {
      deathOverlay.style.display = "flex";
    }

    let timeLeft = respawnTime;

    // Clear any existing timer
    if (this.respawnTimer) {
      clearInterval(this.respawnTimer);
    }

    // Update the timer immediately
    if (respawnTimer) {
      respawnTimer.textContent = `Respawn dans ${timeLeft}...`;
    }

    // Start a new timer that updates each second
    this.respawnTimer = setInterval(() => {
      timeLeft--;

      if (respawnTimer) {
        respawnTimer.textContent = `Respawn dans ${timeLeft}...`;
      }

      if (timeLeft <= 0) {
        clearInterval(this.respawnTimer);
        this.respawnTimer = null;
      }
    }, 1000);
  }

  /**
   ** Hides the death overlay and cleans up the respawn timer
   */
  hideDeathOverlay() {
    const deathOverlay = document.getElementById("death-overlay");

    if (deathOverlay) {
      deathOverlay.classList.add("fade-out");

      setTimeout(() => {
        deathOverlay.style.display = "none";
        deathOverlay.classList.remove("fade-out");
        this.isPlayerDead = false;
      }, 500); // Match the fadeOut animation duration
    }

    if (this.respawnTimer) {
      clearInterval(this.respawnTimer);
      this.respawnTimer = null;
    }
  }

  /**
   ** Checks if the player is currently dead
   * @returns {boolean} True if the player is dead
   */
  isPlayerCurrentlyDead() {
    return this.isPlayerDead;
  }
}

const uiManager = new UIManager();
export default uiManager;

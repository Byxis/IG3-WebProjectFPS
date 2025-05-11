import { GAMESTATE } from "https://localhost:3000/shared/Config.js";
import { getWebSocket } from "./WebSocketManager.js";
import sceneManager from "./SceneManager.js";
import { MessageTypeEnum } from "https://localhost:3000/shared/MessageTypeEnum.js";

export class UIManager {
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

    this.setupListeners();
  }

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

  updatePosition(position) {
    const positionDisplay = document.getElementById("position-display");
    if (this.devMode) {
      positionDisplay.innerText = `X: ${position.x.toFixed(4)} Y: ${position.y.toFixed(4)} Z: ${position.z.toFixed(4)}`;
    } else {
      positionDisplay.innerText = `Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`;
    }
  }

  updateFPS(fps) {
    if (this.devMode) {
      const fpsElement = document.getElementById("fps");
      fpsElement.innerText = `FPS: ${fps}`;
    }
  }

  updateNetworkOffset(offset) {
    if (this.devMode) {
      const netDebugElement = document.getElementById("net-debug");
      netDebugElement.innerText = `Offset: ${offset.toFixed(2)}ms`;
    }
  }

  handleResize() {
    sceneManager.camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    sceneManager.camera.updateProjectionMatrix();
    sceneManager.renderer.setSize(
      globalThis.innerWidth,
      globalThis.innerHeight,
    );
  }

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

    if (name === "Système") {
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

  showConnectionStatus(message) {
    this.connectionErrorText.textContent = message;
    this.connectionError.classList.add('visible');
  }

  showConnectionError(message) {
    this.connectionErrorText.textContent = message;
    this.connectionError.classList.add('visible', 'error');
  }

  hideConnectionError() {
    this.connectionError.classList.remove('visible', 'error');
  }
}

const uiManager = new UIManager();
export default uiManager;

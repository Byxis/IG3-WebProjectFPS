import { GAMESTATE } from "http://localhost:3000/shared/Config.js";
import { getWebSocket } from "../script.js";
import sceneManager from "./SceneManager.js";
import { MessageTypeEnum } from "http://localhost:3000/shared/MessageTypeEnum.js";

export class UIManager {
  constructor() {
    this.chatbox = document.getElementById("chatbox");
    this.chatboxMessages = document.getElementById("chatbox-messages");
    this.chatboxInput = document.getElementById("chatbox-input");
    this.chatboxSend = document.getElementById("chatbox-send");
    this.isChatboxActive = false;
    this.setupListeners();
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
        console.log("Sent message:", message);
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
    });

    globalThis.addEventListener("resize", () => this.handleResize());
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
}

const uiManager = new UIManager();
export default uiManager;

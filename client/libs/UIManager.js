import { GAMESTATE } from "http://localhost:3000/shared/Config.js";
import { getWebSocket } from "../script.js";
import sceneManager from "./SceneManager.js";
import { MessageTypeEnum } from "http://localhost:3000/shared/MessageTypeEnum.js";

export class UIManager {
  constructor() {
    this.chatbox = document.getElementById("chatbox");
    this.chatboxmessages = document.getElementById("chatbox-messages");
    this.chatboxinput = document.getElementById("chatbox-input");
    this.chatboxsend = document.getElementById("chatbox-send");
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

    this.chatboxsend.addEventListener("click", (event) => {
      event.preventDefault();
      const websocket = getWebSocket();
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        const message = this.chatboxinput.value;
        websocket.send(JSON.stringify({
          type: MessageTypeEnum.SEND_CHAT_MESSAGE,
          name: localStorage.getItem("username"),
          message: message,
        }));
        console.log("Sent message:", message);
      }
      this.chatboxinput.value = "";
      this.chatboxinput.focus();
    });

    document.addEventListener("keydown", (event) => {
      if (event.code === "Enter") {
        if (!this.isChatboxActive) {
          document.exitPointerLock();
          this.chatbox.style.opacity = 1;
          this.chatboxinput.focus();
          this.isChatboxActive = true;
        } else {
          if (this.chatboxinput.value.length > 0) {
            this.chatboxsend.click();
          } else {
            this.chatboxinput.blur();
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
          this.chatboxinput.blur();
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

    this.chatboxmessages.appendChild(chatMessage);
    this.chatbox.scrollTop = this.chatbox.scrollHeight;

    setTimeout(() => {
      this.chatboxmessages.scrollTop = this.chatboxmessages.scrollHeight;
      this.chatbox.scrollTop = this.chatbox.scrollHeight;
    }, 10);
  }
}

const uiManager = new UIManager();
export default uiManager;

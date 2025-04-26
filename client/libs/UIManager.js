import { GAMESTATE } from "http://localhost:3000/shared/Config.js";

export class UIManager {

    constructor(sceneManager)
    {
        this.sceneManager = sceneManager;
        this.chatbox = document.getElementById("chatbox");
        this.chatboxinput = document.getElementById("chatbox-input");
        this.chatboxsend = document.getElementById("chatbox-send");
        this.isChatboxActive = false;
        this.setupListeners();
    }

    setupListeners() {

        this.sceneManager.renderer.domElement.addEventListener("click", () => {
            if (!this.isChatboxActive)
            {
                this.sceneManager.renderer.domElement.requestPointerLock();
            }
          });

        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === this.sceneManager.renderer.domElement && !this.isChatboxActive) {
              document.addEventListener("mousemove", this.sceneManager.boundHandleMouseMove);
            } else {
              document.removeEventListener("mousemove", this.sceneManager.boundHandleMouseMove);
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.code in GAMESTATE.keyStates && document.pointerLockElement === this.sceneManager.renderer.domElement) {
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
            this.chatboxinput.value = "";
            this.chatboxinput.focus();
        });
        

        document.addEventListener("keydown", (event) => {
            if (event.code === "Enter") {
                if (!this.isChatboxActive)
                {
                    document.exitPointerLock();
                    this.chatbox.style.opacity = 1;
                    this.chatboxinput.focus();
                    this.isChatboxActive = true;
                }
                else 
                {
                    this.chatboxsend.click();
                }
            }
                
            if (event.code === "Escape") {
                if (this.isChatboxActive) 
                {
                    this.chatboxinput.blur();                    
                    this.isChatboxActive = false;
                    setTimeout(() => {
                        if (!this.isChatboxActive)
                            this.chatbox.style.opacity = 0.5;
                    }, 3000);
                    setTimeout(() => {
                        this.sceneManager.renderer.domElement.requestPointerLock();
                    }, 100);
                }
                else 
                {
                    document.exitPointerLock();
                }
            }
        });

        
        globalThis.addEventListener("resize", () => this.handleResize());
    }

    handleResize() {
        this.sceneManager.camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
        this.sceneManager.camera.updateProjectionMatrix();
        this.sceneManager.renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
      }
}
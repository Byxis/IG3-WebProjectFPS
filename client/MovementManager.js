import * as THREE from 'https://cdn.skypack.dev/three@0.139.2';
import { CONFIG, gameState } from './Constant.js';
import { getWebSocket } from './script.js';

export class MovementManager {
    constructor(sceneManager, wsocket) {
        this.sceneManager = sceneManager;
        this.moveDirection = new THREE.Vector3();
        this.sideDirection = new THREE.Vector3();
        this.targetVelocity = new THREE.Vector3();
        this.wsocket = wsocket;

        // Network optimization properties
        this.lastSentPosition = new THREE.Vector3();
        this.lastSentRotation = new THREE.Euler();
        this.lastSentPitch = 0;
        this.updateInterval = 25; // a value of 50 means 50ms (20 updates/second)
        this.timeSinceLastUpdate = 0;
        this.positionThreshold = 0.1; // Minimum position change to send update
        this.rotationThreshold = 0.01; // Minimum rotation change to send update

        this.raycaster = new THREE.Raycaster();
        this.shootCooldown = 500;
        this.lastShootTime = 0;

        this.forward = 0;
        this.side = 0;
        this.currentSpeed = 0;
        this.isJumping = false;

        this.updateMovementKeybinds();
        this.setupShootingControls();
    }

    update(deltaTime) {
        if (!deltaTime) return;
        
        this.handleMovementUpdate();
        this.handleMovement(deltaTime);
        this.handleJump(deltaTime);
        this.smoothRotation(deltaTime);
        
        // Only check for sending updates periodically
        this.timeSinceLastUpdate += deltaTime * 1000; // Convert to ms
        if (this.timeSinceLastUpdate >= this.updateInterval) {
            this.timeSinceLastUpdate = 0;
        }
    }

    handleMovement(deltaTime) {
        // Calcul of the direction vectors
        this.sceneManager.cameraContainer.getWorldDirection(this.moveDirection);
        this.sideDirection.copy(this.moveDirection).cross(this.sceneManager.cameraContainer.up);

        // Calcul of the target velocity
        this.targetVelocity.set(0, 0, 0);
        if (this.forward !== 0) {
            this.targetVelocity.addScaledVector(this.moveDirection, this.forward * this.currentSpeed);
        }
        if (this.side !== 0) {
            this.targetVelocity.addScaledVector(this.sideDirection, this.side * this.currentSpeed);
        }

        // Smooth the velocity
        gameState.physics.velocity.lerp(this.targetVelocity, CONFIG.MOVEMENT_LERP);

        // Apply the velocity
        const movement = gameState.physics.velocity.clone().multiplyScalar(deltaTime);
        this.sceneManager.cameraContainer.position.add(movement);
    }

    handleJump(deltaTime) {
        // If the player is on the ground and the space key is pressed, jump
        if (gameState.keyStates.Space && !gameState.physics.isJumping) {
            gameState.physics.verticalVelocity = CONFIG.JUMP_FORCE;
            gameState.physics.isJumping = true;
        }

        // Apply gravity
        gameState.physics.verticalVelocity -= CONFIG.GRAVITY * deltaTime;
        
        // Apply vertical velocity
        this.sceneManager.cameraContainer.position.y += gameState.physics.verticalVelocity * deltaTime;

        // If the player is on the ground, stop the vertical velocity
        if (this.sceneManager.cameraContainer.position.y <= gameState.physics.groundLevel) {
            this.sceneManager.cameraContainer.position.y = gameState.physics.groundLevel;
            gameState.physics.verticalVelocity = 0;
            gameState.physics.isJumping = false;
        }
    }

    handleMovementUpdate()
    {
        let oldForward = this.forward;
        let oldSide = this.side;
        let oldSpeed = this.currentSpeed;
        let oldIsJumping = this.isJumping;
        this.forward = 0;
        this.side = 0;

        // Handle movement input from the player (WASD or arrow keys)
        if (gameState.keyStates.KeyW || gameState.keyStates.ArrowUp) this.forward -= 1;
        if (gameState.keyStates.KeyS || gameState.keyStates.ArrowDown) this.forward += 1;
        if (gameState.keyStates.KeyD || gameState.keyStates.ArrowRight) this.side -= 1;
        if (gameState.keyStates.KeyA || gameState.keyStates.ArrowLeft) this.side += 1;

        // Normalize the movement vector to prevent faster diagonal movement
        if (this.forward !== 0 || this.side !== 0) {
            const length = Math.sqrt(this.forward * this.forward + this.side * this.side);
            this.forward /= length;
            this.side /= length;
        }

        // Handle sprinting
        this.currentSpeed = gameState.keyStates.ShiftLeft ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;

        if (gameState.keyStates.Space && !gameState.physics.isJumping) {
            this.isJumping = true;
        }

        if (this.forward !== oldForward || 
            this.side !== oldSide || 
            this.currentSpeed !== oldSpeed || 
            this.isJumping !== oldIsJumping) 
        {
            console.log("Sending movement update");
            this.updateMovementKeybinds();
        }
    }

    smoothRotation(deltaTime) {
        // Smooth camera rotation
        gameState.camera.pitch = THREE.MathUtils.lerp(
            gameState.camera.pitch,
            gameState.camera.targetPitch,
            CONFIG.ROTATION_LERP
        );

        // Apply camera rotation
        this.sceneManager.camera.rotation.x = gameState.camera.pitch;

        // Smooth camera rotation
        this.sceneManager.cameraContainer.rotation.y = THREE.MathUtils.lerp(
            this.sceneManager.cameraContainer.rotation.y,
            gameState.camera.targetRotationY,
            CONFIG.ROTATION_LERP
        );
    }

    updateMovementKeybinds() {
        console.log("Updating movement keybinds");
        if(this.wsocket == null) return;
        if (this.wsocket.readyState !== 1) {
            console.log("Socket not ready, retrying in 100ms");
            setTimeout(() => this.updateMovementKeybinds(), 100);
            return;
        }
        console.log("Socket ready, sending movement update");
        this.wsocket.send(JSON.stringify({
            type: "UPDATE_PLAYER_KEYBINDS",
            name: localStorage.getItem('username'),
            movement: {
                forward: this.forward,
                side: this.side,
                speed: this.currentSpeed,
                isJumping: this.isJumping
            }
        }));
    }

    setupShootingControls() {
        document.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT') {
                return;
            }
            this.shoot();
        });
    }

    shoot() {
        console.log("Shot !");

        const now = performance.now();
        if (now - this.lastShootTime < this.shootCooldown) {
            return;
        }
        this.lastShootTime = now;
        
        const cameraPosition = this.sceneManager.camera.getWorldPosition(new THREE.Vector3());
        const cameraDirection = new THREE.Vector3();
        this.sceneManager.camera.getWorldDirection(cameraDirection);
        
        this.raycaster.set(cameraPosition, cameraDirection);
        
        const scene = this.sceneManager.scene;
        const targets = [];
        
        scene.traverse(object => {
            if (object.isMesh && object.parent && object.parent.name && 
                object.parent.name !== localStorage.getItem('username')) {
                targets.push(object);
            }
        });
        
        const intersects = this.raycaster.intersectObjects(targets, true);
        
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            let hitObject = hit.object;
            
            while (hitObject.parent && !hitObject.parent.name) {
                hitObject = hitObject.parent;
            }
            
            const hitPlayerName = hitObject.parent.name;   
            console.log(hitPlayerName);         
            
            if (hitPlayerName) {
                console.log(`Joueur touché: ${hitPlayerName} à une distance de ${hit.distance.toFixed(2)}`);
                
                this.wsocket.send(JSON.stringify({
                    type: "PLAYER_SHOT",
                    shooter: localStorage.getItem('username'),
                    target: hitPlayerName,
                    hitPoint: {
                        x: hit.point.x,
                        y: hit.point.y,
                        z: hit.point.z
                    }
                }));
            }
        }
    }
}
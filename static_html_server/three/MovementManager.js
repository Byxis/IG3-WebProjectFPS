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

        this.sendNewPlayerPosition();
        this.setupShootingControls();
    }

    update(deltaTime) {
        if (!deltaTime) return;
        
        this.handleMovement(deltaTime);
        this.handleJump(deltaTime);
        this.smoothRotation(deltaTime);
        
        // Only check for sending updates periodically
        this.timeSinceLastUpdate += deltaTime * 1000; // Convert to ms
        if (this.timeSinceLastUpdate >= this.updateInterval) {
            this.sendServerPosition();
            this.timeSinceLastUpdate = 0;
        }
    }

    handleMovement(deltaTime) {
        let forward = 0;
        let side = 0;

        // Handle movement input from the player (WASD or arrow keys)
        if (gameState.keyStates.KeyW || gameState.keyStates.ArrowUp) forward -= 1;
        if (gameState.keyStates.KeyS || gameState.keyStates.ArrowDown) forward += 1;
        if (gameState.keyStates.KeyD || gameState.keyStates.ArrowRight) side -= 1;
        if (gameState.keyStates.KeyA || gameState.keyStates.ArrowLeft) side += 1;

        // Normalize the movement vector to prevent faster diagonal movement
        if (forward !== 0 || side !== 0) {
            const length = Math.sqrt(forward * forward + side * side);
            forward /= length;
            side /= length;
        }

        // Handle sprinting
        const currentSpeed = gameState.keyStates.ShiftLeft ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;

        // Calcul of the direction vectors
        this.sceneManager.cameraContainer.getWorldDirection(this.moveDirection);
        this.sideDirection.copy(this.moveDirection).cross(this.sceneManager.cameraContainer.up);

        // Calcul of the target velocity
        this.targetVelocity.set(0, 0, 0);
        if (forward !== 0) {
            this.targetVelocity.addScaledVector(this.moveDirection, forward * currentSpeed);
        }
        if (side !== 0) {
            this.targetVelocity.addScaledVector(this.sideDirection, side * currentSpeed);
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

    sendNewPlayerPosition() {
        if(this.wsocket == null) return;
        if (this.wsocket.readyState !== 1) {
            setTimeout(() => this.sendNewPlayerPosition(), 100);
            return;
        }
        let sended_player = 
        {
            name: localStorage.getItem('username'),
            position: this.sceneManager.cameraContainer.position,
            rotation: this.sceneManager.cameraContainer.rotation,
            pitch: gameState.camera.pitch
        }

        this.wsocket.send(JSON.stringify({
            type: "ADD_NEW_PLAYER",
            player: sended_player
        }));
    }

    sendServerPosition() {
        if(this.wsocket == null || this.wsocket.readyState !== 1) {
            this.wsocket = getWebSocket();
            return;
        }

        const currentPosition = this.sceneManager.cameraContainer.position;
        const currentRotation = this.sceneManager.cameraContainer.rotation;
        const currentPitch = gameState.camera.pitch;

        // Only send if there's significant change
        const positionChanged = currentPosition.distanceTo(this.lastSentPosition) > this.positionThreshold;
        const rotationChanged = 
            Math.abs(currentRotation.y - this.lastSentRotation.y) > this.rotationThreshold ||
            Math.abs(currentPitch - this.lastSentPitch) > this.rotationThreshold;

        if (positionChanged || rotationChanged) {
            let sended_player = 
            {
                name: localStorage.getItem('username'),
                position: currentPosition,
                rotation: currentRotation,
                pitch: currentPitch
            }
            this.wsocket.send(JSON.stringify({
                type: "UPDATE_PLAYER",
                player: sended_player
            }));
            
            // Save last sent values
            this.lastSentPosition.copy(currentPosition);
            this.lastSentRotation.copy(currentRotation);
            this.lastSentPitch = currentPitch;
        }
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
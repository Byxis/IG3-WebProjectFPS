import { CONFIG } from "./Constant.ts";

export class ServerPhysics {
    private players: { 
        [name: string]: {
            position: { x: number, y: number, z: number },
            rotation: { x: number, y: number, z: number },
            pitch: number,
            velocity: { x: number, y: number, z: number },
            verticalVelocity: number,
            isJumping: boolean,
            lastUpdateTime: number,
            movement: {
                forward: number,
                side: number,
                speed: number,
                isJumping: boolean
            }
        }
    } = {};

    addPlayer(name: string, position: any, rotation: any, pitch: number) {
        this.players[name] = {
            position: { ...position },
            rotation: { ...rotation},
            pitch,
            velocity: { x: 0, y: 0, z: 0 },
            verticalVelocity: 0,
            isJumping: false,
            lastUpdateTime: Date.now(),
            movement: {
                forward: 0,
                side: 0,
                speed: CONFIG.WALK_SPEED,
                isJumping: false
            }
        };
        console.log(this.players);
    }

    removePlayer(name: string) {
        delete this.players[name];
    }

    updatePlayerMovement(name: string, forward: number, side: number, speed: number, isJumping: boolean) {

        if (this.players[name]) {
            
            if (forward !== 0 || side !== 0) {
                const length = Math.sqrt(forward * forward + side * side);
                forward /= length;
                side /= length;
            }

            this.players[name].movement = {
                forward,
                side,
                speed: speed > CONFIG.WALK_SPEED ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED,
                isJumping
            };
        }
    }

    updatePlayerPosition(name: string, position: any, rotation: any, pitch: number) {
        if (this.players[name]) {
            if (this.isValidPosition(name, position)) 
            {
                this.players[name].position = { ...position };
                this.players[name].rotation = { ...rotation };
                this.players[name].pitch = pitch;
                return { corrected: false };
            } 
            else
            {
                this.simulatePlayerMovement(name, 0.016); // simulate 16ms of movement
                return {
                    corrected: true,
                    position: this.players[name].position,
                    rotation: this.players[name].rotation,
                    pitch: this.players[name].pitch
                };
            }
        }
        return { corrected: false };
    }

    private isValidPosition(name: string, newPosition: any): boolean {
        const player = this.players[name];
        if (!player) return false;

        const now = Date.now();
        const deltaTime = (now - player.lastUpdateTime) / 1000;
        
        if (deltaTime < 0.001 || deltaTime > 1.0) {
            player.lastUpdateTime = now;
            return true;
        }

                const maxSpeed = CONFIG.SPRINT_SPEED * 1.2; // 20% of margin
        const maxDistance = maxSpeed * deltaTime;
        
        const dx = newPosition.x - player.position.x;
        const dy = newPosition.y - player.position.y;
        const dz = newPosition.z - player.position.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

        player.lastUpdateTime = now;
        
        if (distance > maxDistance) {
            console.log(`Invalid position: distance=${distance.toFixed(2)}, max=${maxDistance.toFixed(2)}`);
        }
        
        return distance <= maxDistance;
    }

    updateAll() {
        const now = Date.now();
        
        Object.entries(this.players).forEach(([name, player]) => {
            const deltaTime = (now - player.lastUpdateTime) / 1000;
            if (deltaTime > 0 && deltaTime < 0.1) { // Ignore if deltaTime is too high or too low
                this.simulatePlayerMovement(name, deltaTime);
            }
            player.lastUpdateTime = now;
        });
    }

    private simulatePlayerMovement(name: string, deltaTime: number) {
        const player = this.players[name];
        if (!player) return;

        const { forward, side, speed, isJumping } = player.movement;
        
        // Simuler le mouvement uniquement si nécessaire
        if (forward !== 0 || side !== 0) {
            // Calculer les vecteurs de direction
            const moveDirection = {
                x: Math.sin(player.rotation.y),
                y: 0,
                z: Math.cos(player.rotation.y)
            };
            
            const sideDirection = {
                x: -moveDirection.z,
                y: 0,
                z: moveDirection.x
            };

            // Calculer la vélocité cible
            const targetVelocity = { x: 0, y: 0, z: 0 };
            
            if (forward !== 0) {
                targetVelocity.x += moveDirection.x * forward * speed;
                targetVelocity.z += moveDirection.z * forward * speed;
            }
            
            if (side !== 0) {
                targetVelocity.x += sideDirection.x * side * speed;
                targetVelocity.z += sideDirection.z * side * speed;
            }

            // Appliquer LERP à la vélocité
            player.velocity.x += (targetVelocity.x - player.velocity.x) * CONFIG.MOVEMENT_LERP;
            player.velocity.z += (targetVelocity.z - player.velocity.z) * CONFIG.MOVEMENT_LERP;

            // Appliquer la vélocité
            player.position.x += player.velocity.x * deltaTime;
            player.position.z += player.velocity.z * deltaTime;
        } else {
            // Ralentir si aucun mouvement
            player.velocity.x *= 0.9;
            player.velocity.z *= 0.9;
        }

        // Gérer le saut
        if (isJumping && !player.isJumping && player.position.y <= CONFIG.GROUND_LEVEL) {
            player.verticalVelocity = CONFIG.JUMP_FORCE;
            player.isJumping = true;
        }

        // Appliquer la gravité
        player.verticalVelocity -= CONFIG.GRAVITY * deltaTime;
        
        // Appliquer la vélocité verticale
        player.position.y += player.verticalVelocity * deltaTime;

        // Vérifier si le joueur est au sol
        if (player.position.y <= CONFIG.GROUND_LEVEL) {
            player.position.y = CONFIG.GROUND_LEVEL;
            player.verticalVelocity = 0;
            player.isJumping = false;
        }
    }

    getPlayerPosition(name: string) {
        if (this.players[name]) {
            return {
                position: this.players[name].position,
                rotation: this.players[name].rotation,
                pitch: this.players[name].pitch
            };
        }
        return null;
    }
}
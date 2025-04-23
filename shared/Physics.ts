
import { Vector3 } from './Class.ts'
import { CONFIG } from './Config.ts';
var boolean = true;

export function simulatePlayerMovement(playerState, deltaTime) {
    const newState = JSON.parse(JSON.stringify(playerState));
    if (boolean)
    {
      console.log("Player State: ");
      console.log(newState);
      console.log("End ");
      boolean = false;
    }
    
    // --- HORIZONTAL MOVEMENT ---
    
    const moveDirection = new Vector3().fromEuler(newState.rotation);
    const sideDirection = new Vector3().copy(moveDirection).cross(new Vector3(0, -1, 0));
    
    const { forward, side, speed } = newState.movement;
    const targetVelocity = new Vector3(0, 0, 0);
  
    if (forward !== 0) {
      targetVelocity.addScaledVector(moveDirection, forward * speed);
    }
    
    if (side !== 0) {
      targetVelocity.addScaledVector(sideDirection, side * speed);
    }
  
    newState.velocity.x += (targetVelocity.x - newState.velocity.x) * CONFIG.MOVEMENT_LERP;
    newState.velocity.y += (targetVelocity.y - newState.velocity.y) * CONFIG.MOVEMENT_LERP;
    newState.velocity.z += (targetVelocity.z - newState.velocity.z) * CONFIG.MOVEMENT_LERP;
  
    newState.position.x += newState.velocity.x * deltaTime;
    newState.position.z += newState.velocity.z * deltaTime;
    
    // --- VERTICAL MOVEMENT ---
    
    if (newState.movement.isJumping && !newState.isJumping && 
        newState.position.y <= CONFIG.GROUND_LEVEL) {
      newState.verticalVelocity = CONFIG.JUMP_FORCE;
      newState.isJumping = true;
    }
    
    newState.verticalVelocity -= CONFIG.GRAVITY * deltaTime;
    newState.position.y += newState.verticalVelocity * deltaTime;
    
    if (newState.position.y <= CONFIG.GROUND_LEVEL) {
      newState.position.y = CONFIG.GROUND_LEVEL;
      newState.verticalVelocity = 0;
      newState.isJumping = false;
    }
    
    return newState;
  }

  export function isValidPosition(currentPos, newPos, maxSpeed, deltaTime) {
    const dx = newPos.x - currentPos.x;
    const dy = newPos.y - currentPos.y;
    const dz = newPos.z - currentPos.z;
    
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const maxDistance = maxSpeed * deltaTime * 3;
    console.log(distance <= maxDistance);
    
    return distance <= maxDistance;
  }
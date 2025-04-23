import { Vector3 } from './Class.ts'
import { CONFIG } from './Config.ts';

export function simulatePlayerMovement(playerState, deltaTime) {
    // Copy the state to prevent mutation
    const newState = JSON.parse(JSON.stringify(playerState));
    
    // --- HORIZONTAL MOVEMENT ---
    
    const moveDirection = new Vector3().fromEuler(newState.rotation);
    const sideDirection = new Vector3()
      .set(moveDirection.z, 0, -moveDirection.x)
      .normalize();
    
    const { forward, side, isSprinting } = newState.movement;
    const speed = isSprinting ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;
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

  export function isValidPosition(
    currentPos, 
    newPos, 
    deltaTime, 
    isSprinting, 
    isJumping,
    verticalVelocity = 0
) {

    // --- HORIZONTAL CHECK ---
    const dx = newPos.x - currentPos.x;
    const dz = newPos.z - currentPos.z;
    const horizontalDistance = Math.sqrt(dx*dx + dz*dz);
    
    const maxHorizontalSpeed = isSprinting ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;
    const maxHorizontalDistance = maxHorizontalSpeed * deltaTime * 1.5; // Marge de 50%

    const dy = newPos.y - currentPos.y;
    const isVerticalMovementValid = (
        !isJumping 
        ? Math.abs(dy) < CONFIG.GROUND_TOLERANCE * deltaTime
        : (
            dy >= 0 // Doit monter pendant le saut
            && Math.abs(dy) <= CONFIG.MAX_VERTICAL_SPEED * deltaTime * CONFIG.JUMP_TOLERANCE
            && verticalVelocity > 0 // Doit avoir une vélocité positive
        )
    );

    if (horizontalDistance > maxHorizontalDistance || !isVerticalMovementValid) {
        console.log(`[ANTICHEAT] Invalid movement detected:`);
        console.log(`- Horizontal: ${horizontalDistance.toFixed(2)} > ${maxHorizontalDistance.toFixed(2)}`);
        console.log(`- Vertical: ${dy.toFixed(2)} | Jumping: ${isJumping}`);
        console.log(`- Sprint: ${isSprinting} | Velocity: ${verticalVelocity.toFixed(2)}`);
        return false;
    }

    return true;
}
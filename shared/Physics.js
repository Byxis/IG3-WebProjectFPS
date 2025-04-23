import { Vector3 } from './Class.js';
import { CONFIG } from './Config.js';
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
export function isValidPosition(currentPos, newPos, isSprinting, isJumping, deltaTime) {
    const dx = newPos.x - currentPos.x;
    const dy = newPos.y - currentPos.y;
    const dz = newPos.z - currentPos.z;
    // Distance horizontale
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    // Vitesse de base ajustée selon le sprint
    const baseSpeed = isSprinting ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;
    const maxHorizontalDistance = baseSpeed * deltaTime * 4;
    // Distance verticale maximum (affectée par le saut)
    let maxVerticalDistance;
    if (isJumping) {
        maxVerticalDistance = (CONFIG.JUMP_FORCE + CONFIG.GRAVITY * deltaTime) * deltaTime;
    }
    else {
        maxVerticalDistance = CONFIG.GRAVITY * deltaTime * 1.5; // Pour les chutes
    }
    // Vérifier si l'une des distances dépasse le maximum autorisé
    let isValid = true;
    if (horizontalDistance > maxHorizontalDistance) {
        console.log(`Distance horizontale: ${horizontalDistance}, Max: ${maxHorizontalDistance}`);
        isValid = false;
    }
    if (Math.abs(dy) > maxVerticalDistance && newPos.y > CONFIG.GROUND_LEVEL) {
        console.log(`Distance verticale: ${Math.abs(dy)}, Max: ${maxVerticalDistance}`);
        isValid = false;
    }
    if (!isValid) {
        console.log(`Current Position: ${currentPos.x}, ${currentPos.y}, ${currentPos.z}`);
        console.log(`New Position: ${newPos.x}, ${newPos.y}, ${newPos.z}`);
        console.log(`Delta Position: ${dx}, ${dy}, ${dz}`);
        console.log(`Delta Time: ${deltaTime}, Sprint: ${isSprinting}, Jump: ${isJumping}`);
    }
    return isValid;
}

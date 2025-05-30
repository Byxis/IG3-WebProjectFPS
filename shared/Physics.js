import { Vector3 } from "./Class.js";
import { CONFIG } from "./Config.js";
/**
 ** Simulates player movement based on current state and inputs
 * Calculates horizontal and vertical movement with gravity
 * @param {object} playerState - Current state of the player
 * @param {number} deltaTime - Time elapsed since last update
 * @returns {object} Updated player state
 */
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
  newState.velocity.x += (targetVelocity.x - newState.velocity.x) *
    CONFIG.MOVEMENT_LERP;
  newState.velocity.y += (targetVelocity.y - newState.velocity.y) *
    CONFIG.MOVEMENT_LERP;
  newState.velocity.z += (targetVelocity.z - newState.velocity.z) *
    CONFIG.MOVEMENT_LERP;
  newState.position.x += newState.velocity.x * deltaTime;
  newState.position.z += newState.velocity.z * deltaTime;
  // --- VERTICAL MOVEMENT ---
  if (
    newState.movement.isJumping && !newState.isJumping &&
    newState.position.y <= CONFIG.GROUND_LEVEL
  ) {
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
/**
 ** Validates if the client's reported horizontal position is physically possible
 * Checks against maximum possible movement distance considering speed and network delay
 * @param {object} serverPos - The server's recorded position (x,z)
 * @param {object} clientPos - The client's reported position (x,z)
 * @param {number} deltaTime - Time elapsed since last update
 * @param {number} networkTimeOffset - Client-server time difference in milliseconds
 * @param {boolean} isSprinting - Whether the player is sprinting
 * @returns {boolean} Whether the movement is valid
 */
export function isHorizontalMovementValid(
  serverPos,
  clientPos,
  deltaTime,
  networkTimeOffset,
  isSprinting,
) {
  // --- HORIZONTAL CHECK ---
  const dx = clientPos.x - serverPos.x;
  const dz = clientPos.z - serverPos.z;
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  const maxHorizontalSpeed = isSprinting
    ? CONFIG.SPRINT_SPEED
    : CONFIG.WALK_SPEED;
  // Base tolerance for physics simulation
  const physicsDistance = maxHorizontalSpeed * deltaTime + 0.1;
  // Network latency tolerance
  const networkDistance = maxHorizontalSpeed * Math.abs(networkTimeOffset) /
    1000;
  const totalDistance = physicsDistance + networkDistance;
  //// console.log(`HD: ${horizontalDistance.toFixed(2)} | PD: ${physicsDistance.toFixed(2)} | ND: ${networkDistance.toFixed(2)} | TO: ${totalDistance.toFixed(2)}`);
  return !(horizontalDistance > totalDistance && horizontalDistance > 0.1);
}

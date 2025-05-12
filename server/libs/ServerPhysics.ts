import * as Physics from "../../shared/Physics.ts";
import { players, updatePlayer } from "./PlayerHandler.ts";

export class ServerPhysics {
  /**
   ** Updates a player's movement input state
   * @param {string} name - Player name
   * @param {number} forward - Forward movement (-1 to 1)
   * @param {number} side - Side movement (-1 to 1)
   * @param {boolean} isSprinting - Whether player is sprinting
   * @param {boolean} isJumping - Whether player is jumping
   * @param {object} rotation - Player rotation
   * @param {number} pitch - Camera pitch
   * @param {number} networkTimeOffset - Client-server time difference
   */
  updatePlayerMovement(
    name: string,
    forward: number,
    side: number,
    isSprinting: boolean,
    isJumping: boolean,
    rotation: { x: number; y: number; z: number },
    pitch: number,
    networkTimeOffset: number,
  ) {
    if (players[name]) {
      if (forward !== 0 || side !== 0) {
        const length = Math.sqrt(forward * forward + side * side);
        forward /= length;
        side /= length;
      }
      players[name].rotation = { ...rotation };
      players[name].pitch = pitch;
      players[name].networkTimeOffset = networkTimeOffset;

      players[name].movement = {
        forward,
        side,
        isSprinting,
        isJumping,
      };
    }
  }

  /**
   ** Updates a player's position and validates it
   * @param {string} name - Player name
   * @param {object} position - New position
   * @returns {object} Result with correction status and corrected position if needed
   */
  updatePlayerPosition(
    name: string,
    position: { x: number; y: number; z: number },
  ) {
    if (players[name]) {
      let corrected = false;

      if (this.isMovementValid(name, position)) {
        players[name].position.x = position.x;
        players[name].position.z = position.z;
      } else {
        corrected = true;
      }
      //TODO: Check if vertical movement is valid, optional as it will require a lot of work when
      //TODO: the player is jumping and falling with the map
      /*
      if (this.isMovementValid(name, position, Physics.isVerticalMovementValid))
      {
        this.players[name].position.y = position.y;
      }
      else
      {
        corrected = true;
      }
      */
      players[name].position.y = position.y;

      if (corrected) {
        /*console.log(
          `Player ${name} position is invalid. Correcting...`,
          this.players[name].position,
        );*/
        return {
          corrected: true,
          position: players[name].position,
          rotation: players[name].rotation,
          pitch: players[name].pitch,
        };
      }
    }
    return { corrected: false };
  }

  /**
   ** Checks if a player's movement is valid
   * @param {string} name - Player name
   * @param {object} newPosition - New position to validate
   * @returns {boolean} Whether the movement is valid
   */
  private isMovementValid(
    name: string,
    newPosition: { x: number; y: number; z: number },
  ): boolean {
    const player = players[name];
    if (!player) return false;
    
    const now = performance.now();
    const deltaTime = (now - player.lastUpdateTime) / 1000;
    
    return Physics.isHorizontalMovementValid(
      players[name].position,
      newPosition,
      deltaTime,
      player.networkTimeOffset,
      players[name].movement.isSprinting,
    );
  }

  /**
   ** Updates all players based on their movement state
   * @param {number} [deltaTime] - Optional time since last update
   */
  updateAll(deltaTime?: number) {
    const now = performance.now();

    for (const [name, player] of Object.entries(players)) {
      const dt = deltaTime || (now - player.lastUpdateTime) / 1000;
      const updatedPlayer = Physics.simulatePlayerMovement(player, dt);
      updatedPlayer.lastUpdateTime = now;

      players[name] = updatedPlayer;
      updatePlayer(player);
    }
  }

  /**
   ** Gets a player's position
   * @param {string} name - Player name
   * @returns {object|null} Player position or null if not found
   */
  getPlayerPosition(name: string) {
    if (players[name]) {
      return {
        position: players[name].position,
        rotation: players[name].rotation,
        pitch: players[name].pitch,
      };
    }
    return null;
  }

  /**
   ** Checks if it's time to send position update to client
   * @param {string} name - Player name
   * @returns {boolean} Whether update should be sent
   */
  isSendUpdateAvailable(name: string): boolean {
    if (players[name]) {
      const now = performance.now();
      const deltaTime = (now - players[name].lastUpdateSended) / 1000;
      return deltaTime > 1;
    }
    return true;
  }

  /**
   ** Records the time a position update was sent
   * @param {string} name - Player name
   */
  setSendUpdate(name: string) {
    if (players[name]) {
      players[name].lastUpdateSended = performance.now();
    }
  }
}

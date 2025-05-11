import * as Physics from "../../shared/Physics.ts";
import { players, updatePlayer } from "./PlayerHandler.ts";

export class ServerPhysics {
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

  isSendUpdateAvailable(name: string): boolean {
    if (players[name]) {
      const now = performance.now();
      const deltaTime = (now - players[name].lastUpdateSended) / 1000;
      return deltaTime > 1;
    }
    return true;
  }

  setSendUpdate(name: string) {
    if (players[name]) {
      players[name].lastUpdateSended = performance.now();
    }
  }
}

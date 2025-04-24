import { CONFIG } from "../../shared/Config.ts";
import * as Physics from "../../shared/Physics.ts";

export class ServerPhysics {
  private players: {
    [name: string]: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      pitch: number;
      velocity: { x: number; y: number; z: number };
      verticalVelocity: number;
      isJumping: boolean;
      lastUpdateTime: number;
      lastUpdateSended: number;
      networkTimeOffset: number;
      movement: {
        forward: number;
        side: number;
        isSprinting: boolean;
        isJumping: boolean;
      };
    };
  } = {};

  addPlayer(name: string, position: any, rotation: any, pitch: number) {
    this.players[name] = {
      position: { ...position },
      rotation: { ...rotation },
      pitch,
      velocity: { x: 0, y: 0, z: 0 },
      verticalVelocity: 0,
      isJumping: false,
      lastUpdateTime: performance.now(),
      lastUpdateSended: performance.now(),
      networkTimeOffset: 0,
      movement: {
        forward: 0,
        side: 0,
        isSprinting : false,
        isJumping: false,
      },
    };
    console.log(this.players);
  }

  removePlayer(name: string) {
    delete this.players[name];
  }

  updatePlayerMovement(
    name: string,
    forward: number,
    side: number,
    isSprinting: boolean,
    isJumping: boolean,
    rotation: any,
    pitch: number,
    networkTimeOffset: number,
  ) {
    if (this.players[name]) {
      if (forward !== 0 || side !== 0) {
        const length = Math.sqrt(forward * forward + side * side);
        forward /= length;
        side /= length;
      }
      this.players[name].rotation = { ...rotation };
      this.players[name].pitch = pitch;
      this.players[name].networkTimeOffset = networkTimeOffset;

      this.players[name].movement = {
        forward,
        side,
        isSprinting,
        isJumping,
      };
    }
  }

  updatePlayerPosition(
    name: string,
    position: any,
    rotation: any,
    pitch: number,
  ) {
    if (this.players[name]) {
      var corrected = false;
      const ratioX = position.x / this.players[name].position.x;
      const ratioZ = position.z / this.players[name].position.z;
      console.log(`X: ${position.x} vs X: ${this.players[name].position.x} ratio: ${ratioX}`);
      console.warn(`Z: ${position.z} vs Z: ${this.players[name].position.z} ratio: ${ratioZ}`);
      if (this.isMovementValid(name, position)) {
        this.players[name].position.x = position.x;
        this.players[name].position.z = position.z;
      } 
      else
      {
        corrected = true;
      }
      //TODO: Check if vertical movement is valid, optionnal as it will require a lot of work when
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
      this.players[name].position.y = position.y;

      if (corrected)
      {
        /*console.log(
          `Player ${name} position is invalid. Correcting...`,
          this.players[name].position,
        );*/
        return {
          corrected: true,
          position: this.players[name].position,
          rotation: this.players[name].rotation,
          pitch: this.players[name].pitch,
        };
      }
    }
    return { corrected: false };
  }

  private isMovementValid(name: string, newPosition: any): boolean {
    const player = this.players[name];
    if (!player) return false;
    
    return Physics.isHorizontalMovementValid(
        this.players[name].position,
        newPosition,
        1/60,
        player.networkTimeOffset,
        this.players[name].movement.isSprinting,
    );
  }

  async updateAll() {
    const now = performance.now();
  
    for (const [name, player] of Object.entries(this.players)) {
      const deltaTime = (now - player.lastUpdateTime) / 1000;
      const oldMovement = player.movement;
        
      const updatedPlayer = Physics.simulatePlayerMovement(player, deltaTime);
      
      const speed = Math.sqrt(
        updatedPlayer.velocity.x * updatedPlayer.velocity.x +
        updatedPlayer.velocity.z * updatedPlayer.velocity.z
      );
        
      this.players[name] = updatedPlayer;
      this.players[name].lastUpdateTime = now;
    }
  }

  getPlayerPosition(name: string) {
    if (this.players[name]) {
      return {
        position: this.players[name].position,
        rotation: this.players[name].rotation,
        pitch: this.players[name].pitch,
      };
    }
    return null;
  }

  isSendUpdateAvailable(name: string): boolean {
    if (this.players[name]) {
      const now = performance.now();
      const deltaTime = (now - this.players[name].lastUpdateSended) / 1000;
      console.log(deltaTime);
      return deltaTime > 1;
    }
    return true;
  }

  setSendUpdate(name: string) {
    if (this.players[name]) {
      this.players[name].lastUpdateSended = performance.now();
    }
  }
}

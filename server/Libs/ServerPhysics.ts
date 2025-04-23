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
      timestamp: number;
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
      timestamp: Date.now(),
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
    timestamp: number,
  ) {
    if (this.players[name]) {
      if (forward !== 0 || side !== 0) {
        const length = Math.sqrt(forward * forward + side * side);
        forward /= length;
        side /= length;
      }
      this.players[name].rotation = { ...rotation };
      this.players[name].pitch = pitch;
      this.players[name].timestamp = timestamp;

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
      if (this.isValidPosition(name, position)) {
        this.players[name].position = { ...position };
        this.players[name].rotation = { ...rotation };
        this.players[name].pitch = pitch;
        return { corrected: false };
      } else {
        console.log(
          `Player ${name} position is invalid. Correcting...`,
          this.players[name].position,
        );
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

  private isValidPosition(name: string, newPosition: any): boolean {
    const player = this.players[name];
    if (!player) return false;

    const serverTime = Date.now();
    const latency = serverTime - this.players[name].timestamp;
    
    // Compensation de latence (en secondes)
    const adjustedDeltaTime = Math.min(0.2, latency / 1000); // Ne pas dépasser 200ms
    
    return Physics.isValidPosition(
        this.players[name].position,
        newPosition,
        adjustedDeltaTime,
        this.players[name].movement.isSprinting,
        this.players[name].movement.isJumping
    );
  }

  async updateAll() {
    const now = performance.now();
  
    for (const [name, player] of Object.entries(this.players)) {
      const deltaTime = (now - player.lastUpdateTime) / 1000;
      if (deltaTime > 0 && deltaTime < 0.1) { // Ignore if deltaTime is too high or too low
        const oldMovement = player.movement;
        
        const updatedPlayer = Physics.simulatePlayerMovement(player, deltaTime);
  
        const dx = player.position.x - updatedPlayer.position.x;
        const dy = player.position.y - updatedPlayer.position.y;
        const dz = player.position.z - updatedPlayer.position.z;
        
        this.players[name] = updatedPlayer;
        
        if (oldMovement !== player.movement) {
          console.log(`Player ${name} moved:`, player.movement);
          console.log(`Player ${name} position:`, player.position);
        }
      }
      player.lastUpdateTime = now;
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
}

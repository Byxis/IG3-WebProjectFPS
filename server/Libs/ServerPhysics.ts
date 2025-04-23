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
      movement: {
        forward: number;
        side: number;
        speed: number;
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
      lastUpdateTime: Date.now(),
      movement: {
        forward: 0,
        side: 0,
        speed: CONFIG.WALK_SPEED,
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
    speed: number,
    isJumping: boolean,
  ) {
    if (this.players[name]) {
      if (forward !== 0 || side !== 0) {
        const length = Math.sqrt(forward * forward + side * side);
        forward /= length;
        side /= length;
      }

      this.players[name].movement = {
        forward,
        side,
        speed: speed > CONFIG.WALK_SPEED
          ? CONFIG.SPRINT_SPEED
          : CONFIG.WALK_SPEED,
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

    const now = Date.now();
    const deltaTime = (now - player.lastUpdateTime) / 1000;

    if (deltaTime < 0.001 || deltaTime > 1.0) {
      player.lastUpdateTime = now;
      return true;
    }

    const isValid = Physics.isValidPosition(
      player.position,
      newPosition,
      player.movement.speed,
      deltaTime,
    );
    return isValid;
  }

  async updateAll() {
    const now = Date.now();
  
    for (const [name, player] of Object.entries(this.players)) {
      const deltaTime = (now - player.lastUpdateTime) / 1000;
      if (deltaTime > 0 && deltaTime < 0.1) { // Ignore if deltaTime is too high or too low
        const oldMovement = player.movement;
        
        const updatedPlayer = Physics.simulatePlayerMovement(player, deltaTime);
  
        const dx = player.position.x - updatedPlayer.position.x;
        const dy = player.position.y - updatedPlayer.position.y;
        const dz = player.position.z - updatedPlayer.position.z;
        console.log("dx:", dx, "dy:", dy, "dz:", dz);
        
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

  private async logPositionDelta(name: string, dx: number, dy: number, dz: number) {
    try {
      const timestamp = new Date().toISOString();
      const logDir = "./logs";
      
      try {
        await Deno.mkdir(logDir, { recursive: true });
      } catch (error) {
        if (!(error instanceof Deno.errors.AlreadyExists)) {
          throw error;
        }
      }
      
      const logFile = `${logDir}/position_deltas.log`;
      const logEntry = `${timestamp} | Player: ${name} | dx: ${dx.toFixed(6)}, dy: ${dy.toFixed(6)}, dz: ${dz.toFixed(6)}\n`;
      
      // Ajouter l'entrée au fichier de log
      await Deno.writeTextFile(logFile, logEntry, { append: true });
    } catch (error) {
      console.error("Error writing to log file:", error);
    }
  }
}

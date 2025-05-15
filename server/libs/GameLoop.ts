
export class GameLoop {
  private targetFPS: number;
  private fixedTimeStep: number;
  private running: boolean = false;
  private accumulator: number = 0;
  private lastFrameTime: number = 0;
  private updateCallback: (deltaTime: number) => void;

  /**
   ** Creates a new game loop
   * @param {number} targetFPS - Target frames per second
   * @param {Function} updateCallback - Function to call on each update
   */
  constructor(targetFPS: number, updateCallback: (deltaTime: number) => void) {
    this.targetFPS = targetFPS;
    this.fixedTimeStep = 1000 / targetFPS;
    this.updateCallback = updateCallback;
  }

  /**
   ** Starts the game loop
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.lastFrameTime = performance.now();
    this.update();
  }

  /**
   ** Stops the game loop
   */
  stop(): void {
    this.running = false;
  }

  /**
   ** The main update function called on each tick
   * Uses a fixed timestep to ensure consistent physics
   */
  private update(): void {
    if (!this.running) return;

    const currentTime = performance.now();
    let frameTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    if (frameTime > 200) {
      frameTime = 200;
    }

    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedTimeStep) {
      this.updateCallback(this.fixedTimeStep / 1000);
      this.accumulator -= this.fixedTimeStep;
    }

    setTimeout(() => this.update(), 1);
  }
}

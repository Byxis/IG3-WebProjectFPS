export class GameLoop {
  private targetFPS: number;
  private fixedTimeStep: number;
  private running: boolean = false;
  private accumulator: number = 0;
  private lastFrameTime: number = 0;
  private updateCallback: (deltaTime: number) => void;

  constructor(targetFPS: number, updateCallback: (deltaTime: number) => void) {
    this.targetFPS = targetFPS;
    this.fixedTimeStep = 1000 / targetFPS;
    this.updateCallback = updateCallback;
  }

  start(): void {
    if (this.running) return;
    
    this.running = true;
    this.lastFrameTime = performance.now();
    this.update();
  }

  stop(): void {
    this.running = false;
  }

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

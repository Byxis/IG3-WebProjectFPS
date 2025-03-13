import { MovementManager } from './MovementManager.js';
import { SceneManager } from './SceneManager.js';
import { gameState } from './Constant.js';
import { Player } from './Player.js';
import * as THREE from 'https://cdn.skypack.dev/three@0.139.2';

export class Game {
    constructor(wsocket) {
        this.players = {};
        this.sceneManager = new SceneManager();
        this.movementManager = new MovementManager(this.sceneManager, wsocket);
        this.animate = this.animate.bind(this);
        gameState.physics.lastTime = performance.now();
    }

    animate(currentTime) {
        requestAnimationFrame(this.animate);

        const deltaTime = (currentTime - gameState.physics.lastTime) / 1000;
        gameState.physics.lastTime = currentTime;

        this.movementManager.update(deltaTime);
        this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    }

    start() {
        this.animate(performance.now());
    }

    addNewPlayer(name, position, rotation, pitch) 
    {
        if (name == localStorage.getItem('username'))
        {
            return;
        }
        this.players[name] = new Player(name, position, rotation, pitch);
        this.sceneManager.scene.add(this.players[name].playerGroup);
    }

    removePlayer(name)
    {
        if (this.players[name] == null)
        {
            return
        }
        this.sceneManager.scene.remove(this.players[name].playerGroup);
        delete this.players[name];
    }

    updatePlayerPosition(name, position, rotation, pitch)
    {
        if (this.players[name] == null)
        {
            this.addNewPlayer(name, position, rotation, pitch);
            return;
        }
        this.players[name].updatePosition(position, rotation, pitch);
    }
}
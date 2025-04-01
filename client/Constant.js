import * as THREE from 'https://cdn.skypack.dev/three@0.139.2';

export const CONFIG = {
    // Movement
    WALK_SPEED: 3.0,
    SPRINT_SPEED: 6.0,
    MOUSE_SENSITIVITY: 0.001,
    
    // Jump physics
    JUMP_FORCE: 7,
    GRAVITY: 20,
    
    // Camera configuration
    FOV: 75,
    NEAR: 0.1,
    FAR: 1000,

    // Smoothing movement
    MOVEMENT_LERP: 0.1,
    ROTATION_LERP: 0.3
};

export const gameState = {
    // Key States (pressed or not)
    keyStates: {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
        KeyW: false,
        KeyA: false,
        KeyS: false,
        KeyD: false,
        ShiftLeft: false,
        Space: false
    },
    
    // Physics state
    physics: {
        velocity: new THREE.Vector3(),
        verticalVelocity: 0,
        isJumping: false,
        groundLevel: 0,
        lastTime: 0
    },
    
    // Camera state
    camera: {
        pitch: 0,
        targetPitch: 0,
        targetRotationY: 0
    }
};

export const playerList = [];
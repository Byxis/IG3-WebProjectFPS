import * as THREE from "https://cdn.skypack.dev/three@0.139.2";
import { CONFIG, GAMESTATE } from "http://localhost:3000/shared/Config.js";

export class SceneManager {
  constructor() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupTestCube();
    this.setupEventListeners();
    this.hasPitchChanged = false;
  }

  setupScene() {
    this.scene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);

    this.scene.add(ambientLight);
    this.scene.add(directionalLight);

    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x999999,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -1;
    this.scene.add(plane);

    const axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);
  }

  setupCamera() {
    // Create a camera and add it to the scene

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.FOV,
      window.innerWidth / window.innerHeight,
      CONFIG.NEAR,
      CONFIG.FAR,
    );

    // Create a container for the camera to allow rotation
    this.cameraContainer = new THREE.Object3D();
    this.scene.add(this.cameraContainer);
    this.cameraContainer.add(this.camera);
    this.cameraContainer.position.z = 5;
  }

  setupRenderer() {
    // Create a renderer and add it to the DOM
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
  }

  setupTestCube() {
    // Create a test cube and add it to the scene (To be removed later)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
  }

  handleMouseMove(event) {
    // Check if the pointer is locked and if so, rotate the camera
    if (document.pointerLockElement === this.renderer.domElement) {
      const oldPitch = GAMESTATE.camera.pitch;
      const deltaX = event.movementX * CONFIG.MOUSE_SENSITIVITY;
      const deltaY = event.movementY * CONFIG.MOUSE_SENSITIVITY;

      GAMESTATE.camera.targetRotationY -= deltaX;
      GAMESTATE.camera.targetPitch -= deltaY;
      GAMESTATE.camera.targetPitch = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, GAMESTATE.camera.targetPitch),
      );
    }
  }

  setPitchHasChanged(value) {
    this.hasPitchChanged = value;
  }

  getPitchHasChanged() {
    return this.hasPitchChanged;
  }

  setupEventListeners() {
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    
    this.renderer.domElement.addEventListener("click", () => {
      this.renderer.domElement.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.addEventListener("mousemove", this.boundHandleMouseMove);
      } else {
        document.removeEventListener("mousemove", this.boundHandleMouseMove);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.code in GAMESTATE.keyStates) {
        GAMESTATE.keyStates[event.code] = true;
        event.preventDefault();
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.code in GAMESTATE.keyStates) {
        GAMESTATE.keyStates[event.code] = false;
        event.preventDefault();
      }
    });

    window.addEventListener("resize", () => this.handleResize());
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

import * as THREE from "https://cdn.skypack.dev/three@0.139.2";
import { CONFIG, GAMESTATE } from "https://localhost:3000/shared/Config.js";

export class SceneManager {
  /**
   ** Initializes the scene manager and sets up the 3D environment.
   * Creates scene, camera, renderer, and basic test objects.
   */
  constructor() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupTestCube();
    this.setupMouse();
    this.hasPitchChanged = false;
  }

  /**
   ** Sets up the Three.js scene with lights and basic environment.
   * Creates ambient and directional lights, a ground plane, and coordinate axes.
   * @returns {void}
   */
  setupScene() {
    this.scene = new THREE.Scene();
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    directionalLight.castShadow = true;
    
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    
    this.scene.add(directionalLight);

    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x999999,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.2
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -1;
    plane.receiveShadow = true;
    this.scene.add(plane);

    const axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);
  }

  /**
   ** Configures the camera and its container for player perspective.
   * @returns {void}
   */
  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.FOV,
      globalThis.innerWidth / globalThis.innerHeight,
      CONFIG.NEAR,
      CONFIG.FAR,
    );
    
    this.cameraContainer = new THREE.Object3D();
    this.scene.add(this.cameraContainer);
    this.cameraContainer.add(this.camera);
    
    this.camera.position.y = CONFIG.CAMERA_HEIGHT;
    this.cameraContainer.position.set(0, 0, 5);
    this.camera.lookAt(new THREE.Vector3(0, this.camera.position.y, 0));
  }

  /**
   ** Creates and configures the WebGL renderer.
   * Sets renderer size based on window dimensions and appends it to the DOM.
   * @returns {void}
   */
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    
    this.renderer.setClearColor(0x87CEEB);
    this.renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
  }

  /**
   ** Creates a test cube for development purposes.
   * Adds a simple green cube to the scene for reference.
   * @returns {void}
   */
  setupTestCube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
  }

  /**
   ** Handles mouse movement for camera rotation.
   * Updates camera rotation based on mouse movement when pointer is locked.
   * @param {MouseEvent} event - The mouse movement event.
   * @returns {void}
   */
  handleMouseMove(event) {
    if (document.pointerLockElement === this.renderer.domElement) {
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

  /**
   ** Sets the pitch change tracking flag.
   * Used to determine when to send rotation updates to the server.
   * @param {boolean} value - Whether the pitch has changed.
   * @returns {void}
   */
  setPitchHasChanged(value) {
    this.hasPitchChanged = value;
  }

  /**
   ** Gets the current state of the pitch change tracking flag.
   * @returns {boolean} Whether the pitch has changed since the last check.
   */
  getPitchHasChanged() {
    return this.hasPitchChanged;
  }

  /**
   ** Sets up mouse event handling.
   * Binds the mouse move handler to maintain proper context.
   * @returns {void}
   */
  setupMouse() {
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
  }
}

const sceneManager = new SceneManager();
export default sceneManager;

import * as THREE from "https://cdn.skypack.dev/three@0.139.2";

export class Player {
  /**
   ** Creates a new player representation in the 3D world.
   * Constructs a 3D model with body and head to represent the player.
   * @param {string} name - The player's username.
   * @param {Object} position - The initial position coordinates {x,y,z}.
   * @param {number} pitch - The initial camera pitch angle.
   */
  constructor(name, position, pitch) {
    this.name = name;

    // Creation of the player group
    this.playerGroup = new THREE.Group();
    this.playerGroup.name = name;

    // Create a cube to represent the player
    const bodyGeometry = new THREE.BoxGeometry(0.6, 1.5, 0.6);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: false,
    });
    this.cube = new THREE.Mesh(bodyGeometry, bodyMaterial);

    // Create a head
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const headMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      wireframe: false,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1;

    this.playerGroup.add(this.cube);
    this.playerGroup.add(head);

    this.playerGroup.position.set(position.x, position.y, position.z);
    this.playerGroup.pitch = pitch;
  }

  /**
   ** Updates the player's position, rotation and pitch angle.
   * Synchronizes the 3D model with the latest network data.
   * @param {Object} position - The new position coordinates {x,y,z}.
   * @param {Object} rotation - The new rotation angles {x,y,z}.
   * @param {number} pitch - The new camera pitch angle.
   * @returns {void}
   */
  updatePosition(position, rotation, pitch) {
    if (position) {
      this.playerGroup.position.set(position.x, position.y, position.z);
    }

    if (rotation) {
      this.playerGroup.rotation.set(0, rotation.y, 0);
    }

    if (pitch !== undefined) {
      this.playerGroup.pitch = pitch;
    }
  }
}

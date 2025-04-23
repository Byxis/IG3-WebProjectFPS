import * as THREE from "https://cdn.skypack.dev/three@0.139.2";

export class Player {
  constructor(name, position, rotation, pitch) {
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

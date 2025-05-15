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
    this.isDead = false;
    this.deathAnimation = null;
    this.respawnAnimation = null;
    this.originalRotationX = 0;
    
    // Creation of the player group
    this.playerGroup = new THREE.Group();
    this.playerGroup.name = name;

    // Create a cube to represent the player
    const bodyGeometry = new THREE.BoxGeometry(0.6, 1.5, 0.6);
    this.bodyMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: false,
    });
    this.cube = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
    this.cube.position.y = 0.75;

    // Create a head
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    this.headMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      wireframe: false,
    });
    const head = new THREE.Mesh(headGeometry, this.headMaterial);
    head.position.y = 1.75;
    
    this.head = head;
    this.playerGroup.add(this.cube);
    this.playerGroup.add(head);

    this.playerGroup.position.set(position.x, position.y - 0.75, position.z);
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
      this.playerGroup.position.set(position.x, position.y - 0.75, position.z);
    }

    if (rotation && !this.isDead) {
      this.playerGroup.rotation.y = rotation.y;
    }

    if (pitch !== undefined) {
      this.playerGroup.pitch = pitch;
    }
  }
  
  /**
   ** Starts death animation for the player
   * Makes the player rotate to lie flat
   * @returns {void}
   */
  playDeathAnimation() {
    if (this.isDead) return; // Already dead, don't restart animation
    
    this.isDead = true;
    this.originalRotationX = this.playerGroup.rotation.x;
    
    if (this.deathAnimation) {
      cancelAnimationFrame(this.deathAnimation);
    }
    
    if (this.respawnAnimation) {
      cancelAnimationFrame(this.respawnAnimation);
      this.respawnAnimation = null;
    }
    
    const animationDuration = 1000;
    const startTime = performance.now();
    const targetRotation = -Math.PI / 2;
    
    // Animation loop
    const animate = (time) => {
      const elapsed = time - startTime;
      
      if (elapsed < animationDuration) {
        const progress = elapsed / animationDuration;
        
        const eased = 1 - Math.pow(1 - progress, 3);
        
        this.playerGroup.rotation.x = this.originalRotationX + 
                                      (targetRotation - this.originalRotationX) * eased;
        
        this.deathAnimation = requestAnimationFrame(animate);
      } else {
        this.playerGroup.rotation.x = targetRotation;
        this.deathAnimation = null;
      }
    };
    this.deathAnimation = requestAnimationFrame(animate);
  }

  /**
   ** Resets the player to alive state
   * @returns {void}
   */
  respawn() {
    if (!this.isDead) return;
    
    if (this.deathAnimation) {
      cancelAnimationFrame(this.deathAnimation);
      this.deathAnimation = null;
    }

    const targetRotation = this.originalRotationX || 0;
    
    this.playerGroup.rotation.x = targetRotation;
    this.respawnAnimation = null;
    this.isDead = false;
  }
}

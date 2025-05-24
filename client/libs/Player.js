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
    const bodyGeometry = new THREE.BoxGeometry(0.6, 1.70, 0.6);
    this.bodyMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: false,
      transparent: false,
    });
    this.cube = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
    this.cube.position.y = 0.55;
    this.cube.castShadow = true;

    // Create a head
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    this.headMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      wireframe: false,
      transparent: false,
    });
    const head = new THREE.Mesh(headGeometry, this.headMaterial);
    head.position.y = 1.75;
    head.castShadow = true;

    this.createUsernameSprite(name);

    this.head = head;
    this.playerGroup.add(this.cube);
    this.playerGroup.add(head);

    this.playerGroup.position.set(position.x, position.y - 0.75, position.z);
    this.playerGroup.pitch = pitch;
  }

  /**
   * Creates a text sprite to display the player's username
   * @param {string} username - The player's username to display
   */
  createUsernameSprite(username) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    context.font = "bold 48px Arial";

    const textMetrics = context.measureText(username);
    const textWidth = textMetrics.width;
    const padding = 20;
    const minBoxWidth = 80;
    const maxBoxWidth = 400;
    const boxHeight = 60;
    
    let boxWidth = Math.max(minBoxWidth, Math.min(maxBoxWidth, textWidth + (padding * 2)));
    
    let fontSize = 48;
    if (textWidth + (padding * 2) > maxBoxWidth) {
      fontSize = Math.floor((maxBoxWidth - (padding * 2)) / textWidth * 48);
      fontSize = Math.max(24, fontSize);
      context.font = `bold ${fontSize}px Arial`;
      
      const newTextWidth = context.measureText(username).width;
      boxWidth = Math.min(maxBoxWidth, newTextWidth + (padding * 2));
    }
    
    canvas.width = Math.max(256, boxWidth + 40);
    canvas.height = 64;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `bold ${fontSize}px Arial`;

    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = (canvas.height - boxHeight) / 2;
    const cornerRadius = 10;

    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.beginPath();
    context.moveTo(boxX + cornerRadius, boxY);
    context.lineTo(boxX + boxWidth - cornerRadius, boxY);
    context.arcTo(
      boxX + boxWidth,
      boxY,
      boxX + boxWidth,
      boxY + cornerRadius,
      cornerRadius,
    );
    context.lineTo(boxX + boxWidth, boxY + boxHeight - cornerRadius);
    context.arcTo(
      boxX + boxWidth,
      boxY + boxHeight,
      boxX + boxWidth - cornerRadius,
      boxY + boxHeight,
      cornerRadius,
    );
    context.lineTo(boxX + cornerRadius, boxY + boxHeight);
    context.arcTo(
      boxX,
      boxY + boxHeight,
      boxX,
      boxY + boxHeight - cornerRadius,
      cornerRadius,
    );
    context.lineTo(boxX, boxY + cornerRadius);
    context.arcTo(boxX, boxY, boxX + cornerRadius, boxY, cornerRadius);
    context.closePath();
    context.fill();

    context.fillStyle = "white";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(username, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });

    this.usernameSprite = new THREE.Sprite(spriteMaterial);
    const baseScale = 1;
    const scaleWidth = (canvas.width / 256) * baseScale;
    this.usernameSprite.scale.set(scaleWidth, 0.25, 1);
    this.usernameSprite.position.y = 2.4;

    this.playerGroup.add(this.usernameSprite);
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

  /**
   ** Marks the player as disconnected with visual effects
   * Makes the player appear transparent and grayscale
   * @returns {void}
   */
  markAsDisconnected() {
    this.bodyMaterial.color.set(0x888888);
    this.bodyMaterial.transparent = true;
    this.bodyMaterial.opacity = 0.4;
    this.bodyMaterial.needsUpdate = true;

    this.headMaterial.color.set(0x888888);
    this.headMaterial.transparent = true;
    this.headMaterial.opacity = 0.4;
    this.headMaterial.needsUpdate = true;

    if (this.usernameSprite && this.usernameSprite.material) {
      this.usernameSprite.material.opacity = 0.4;
      this.usernameSprite.material.needsUpdate = true;
    }

    this.isDisconnected = true;
  }

  /**
   ** Restores the player's original appearance after reconnection
   * Reverses the disconnected visual effects
   * @returns {void}
   */
  restoreFromDisconnected() {
    if (!this.isDisconnected) return;

    this.bodyMaterial.color.set(0xff0000);
    this.bodyMaterial.transparent = false;
    this.bodyMaterial.opacity = 1.0;
    this.bodyMaterial.needsUpdate = true;

    this.headMaterial.color.set(0xffff00);
    this.headMaterial.transparent = false;
    this.headMaterial.opacity = 1.0;
    this.headMaterial.needsUpdate = true;

    if (this.usernameSprite && this.usernameSprite.material) {
      this.usernameSprite.material.opacity = 1.0;
      this.usernameSprite.material.needsUpdate = true;
    }

    this.isDisconnected = false;
  }
}

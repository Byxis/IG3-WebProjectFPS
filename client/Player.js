import * as THREE from 'https://cdn.skypack.dev/three@0.139.2';

export class Player 
{
    constructor(name, position, rotation, pitch)
    {
        this.name = name;

        // Création d'un groupe pour représenter le joueur
        this.playerGroup = new THREE.Group();
        this.playerGroup.name = name;
        
        // Cube principal (corps)
        const bodyGeometry = new THREE.BoxGeometry(0.6, 1.5, 0.6);
        const bodyMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,  // Rouge vif
            wireframe: false  // Solide
        });
        this.cube = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        // Ajouter une tête visible
        const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const headMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,  // Jaune vif
            wireframe: false  // Solide
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1;
        
        this.playerGroup.add(this.cube);
        this.playerGroup.add(head);
        
        this.playerGroup.position.set(position.x, position.y, position.z);
        //this.playerGroup.rotation.set(rotation.x, rotation.y, rotation.z);
        
        // Stocker pitch séparément
        this.playerGroup.pitch = pitch;
    }

    updatePosition(position, rotation, pitch)
    {
        this.playerGroup.position.set(position.x, position.y, position.z);
        //this.playerGroup.rotation.set(rotation.x, rotation.y, rotation.z);
        this.playerGroup.pitch = pitch;
    }
}
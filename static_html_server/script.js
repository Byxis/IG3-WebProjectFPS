import { Game } from './Game.js';
import * as THREE from 'https://cdn.skypack.dev/three@0.139.2';
import { gameState } from './Constant.js';

localStorage.setItem('username', 'player' + Math.floor(Math.random() * 1000));

let name = document.getElementById('name');
name.innerHTML = localStorage.getItem('username');

const wsocket = new WebSocket("ws://localhost:3000");
initiateWebSocketConnection();

function initiateWebSocketConnection() {
    console.log(localStorage.getItem('auth_token'));

	wsocket.onopen = function() {
        console.log("WebSocket connection opened");

        wsocket.send(JSON.stringify({
            type: "ADD_NEW_PLAYER",
            player: 
            {
                name: localStorage.getItem('username'),
                position: {
                    x: 0,
                    y: 0,
                    z: 5
                },
                rotation: {
                    x: 0,
                    y: 0,
                    z: 0
                },
                pitch: 0    
            }
        }));
    };
  
	wsocket.onmessage = function() {
        const message = JSON.parse(event.data);
        console.log("WebSocket message received:", message);
        let player = message.player;

        //debugSceneObjects(game.sceneManager.scene);
        if(message.type == "NEW_PLAYER")
        {
            if(game.players[player.name] != null)
            {
                return;
            }
            game.addNewPlayer(player.name, player.position, player.rotation, player.pitch);
        }
        else if (message.type == "REMOVE_PLAYER")
        {
            game.removePlayer(player.name);
        }
        else if (message.type == "UPDATE_PLAYER_POSITION")
        {
            game.updatePlayerPosition(player.name, player.position, player.rotation, player.pitch);
        }
        else if (message.type == "POSITION_CORRECTION")
        {
            const correctedPosition = message.position;
            const correctedPitch = message.pitch;
            
            // Apply the corrected position and pitch to the camera container progressively
            console.log("hey : "+game.sceneManager);
            game.sceneManager.cameraContainer.position.x = correctedPosition.x;
            game.sceneManager.cameraContainer.position.y = correctedPosition.y;
            game.sceneManager.cameraContainer.position.z = correctedPosition.z;
            
            //gameState.camera.targetPitch = correctedPitch;
            
            console.log("Position corrigée par le serveur");
        }
	};
  
	wsocket.onclose = function() {
	    console.log("WebSocket connection closed");
        wsocket.send(JSON.stringify({
            type: "DISCONNECT",
            name: localStorage.getItem('username'),
        }));
	};
  
	wsocket.onerror = function() {
	    console.error("WebSocket error:", error);
	};
}

export function getWebSocket()
{
    return wsocket;
}

const game = new Game(wsocket);
game.start();

function debugSceneObjects(scene) {
    console.log("=== DÉBUT DE LA HIÉRARCHIE DE LA SCÈNE ===");
    
    function traverseObject(object, depth = 0) {
        const indent = '  '.repeat(depth);
        const position = object.position ? 
            `(x:${object.position.x.toFixed(2)}, y:${object.position.y.toFixed(2)}, z:${object.position.z.toFixed(2)})` : '';
        const type = object.type || 'Unknown';
        const name = object.name || 'unnamed';
        
        console.log(`${indent}► ${type}: "${name}" ${position}`);
        
        if (object.children && object.children.length > 0) {
            object.children.forEach(child => traverseObject(child, depth + 1));
        }
    }
    
    traverseObject(scene);
    console.log("=== FIN DE LA HIÉRARCHIE DE LA SCÈNE ===");
}

function advancedDebugSceneObjects(scene) {
    console.log("=== DÉBUT DE LA HIÉRARCHIE DE LA SCÈNE ===");
    
    function traverseObject(object, depth = 0) {
        const indent = '  '.repeat(depth);
        const position = object.position ? 
            `(x:${object.position.x.toFixed(2)}, y:${object.position.y.toFixed(2)}, z:${object.position.z.toFixed(2)})` : '';
        const type = object.type || 'Unknown';
        const name = object.name || 'unnamed';
        
        console.log(`${indent}► ${type}: "${name}" ${position}`);
        
        if (object.type === 'Mesh') {
            console.log(`${indent}  - Material: ${object.material.type}, Color: ${object.material.color ? '#' + object.material.color.getHexString() : 'N/A'}`);
            console.log(`${indent}  - Geometry: ${object.geometry.type}, Vertices: ${object.geometry.attributes.position ? object.geometry.attributes.position.count : 'N/A'}`);
            console.log(`${indent}  - Visible: ${object.visible}`);
        }
        
        if (object.children && object.children.length > 0) {
            object.children.forEach(child => traverseObject(child, depth + 1));
        }
    }
    
    traverseObject(scene);
    console.log("=== FIN DE LA HIÉRARCHIE DE LA SCÈNE ===");
}
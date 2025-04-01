const players = {};

export function initiateNewPlayer(data, connections)
{
    const player = {
        name: data.player.name,
        position: data.player.position,
        rotation: data.player.rotation,
        pitch: data.player.pitch,
    };
    players[data.player.name] = player;
    
    connections.forEach((ws) => {
        ws.send(JSON.stringify(
            {
                type: "NEW_PLAYER", player: player
            }
        ));
    });
}

export function updatePlayer(data, connections)
{
    console.log(JSON.stringify(
    {
        type: "UPDATE_PLAYER", 
        player: data.player
    }));

    connections.forEach((ws) => {
        ws.send(JSON.stringify(
            {
                type: "UPDATE_PLAYER", 
                player: data.player
            }
        ));
    });
}

export function removePlayer(data, connections)
{
    console.log(JSON.stringify(
    {
        type: "REMOVE_PLAYER", 
        player: data.player
    }));

    connections.forEach((ws) => {
        ws.send(JSON.stringify(
            {
                type: "REMOVE_PLAYER", 
                player: data.player
            }
        ));
    });
}
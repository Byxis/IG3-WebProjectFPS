import { Application, Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { initiateNewPlayer, updatePlayer } from "./Libs/PlayerHandler.ts";
import { ServerPhysics } from "./Libs/ServerPhysics.ts";
import { MessageTypeEnum } from "./Libs/MessageTypeEnum.ts";

const router = new Router();
const app = new Application();
const connections: WebSocket[] = [];
const serverPhysics = new ServerPhysics();

console.log("Server started");

const physicsInterval = setInterval(() => {
    serverPhysics.updateAll();
}, 16);

app.use(
    oakCors({
        origin: "http://localhost:8080",
        optionsSuccessStatus: 200,
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

if (Deno.args.length < 1) {
    console.log(
        `Usage: $ deno run --allow-net server.ts PORT [CERT_PATH KEY_PATH]`,
    );
    Deno.exit();
}

const options = { port: Deno.args[0] };

if (Deno.args.length >= 3) {
    options.secure = true;
    options.cert = await Deno.readTextFile(Deno.args[1]);
    options.key = await Deno.readTextFile(Deno.args[2]);
    console.log(`SSL conf ready (use https)`);
}

console.log(`Oak back server running on port ${options.port}`);


router.get("/", (ctx) => {
    if (!ctx.isUpgradable) {
        ctx.throw(501);
    }
    const ws = ctx.upgrade();

    connections.push(ws); 
    var i = 0;
    console.log("New connection");

    /*Object.values(players).forEach(p => {
        ws.send(JSON.stringify(
            {
                type: "NEW_PLAYER", player: p
            }
        )); 
    });*/

    ws.onerror = (_error) => {
        const index = connections.indexOf(ws);

        if (index !== -1) {
            connections.splice(index, 1);
        }
        console.log(`- websocket error`);
    };


    ws.onmessage = async (event) => {
        const message = event.data;
        const data = JSON.parse(message);
        const type = MessageTypeEnum[data.type as keyof typeof MessageTypeEnum];
        
        switch (type) {
            case MessageTypeEnum.ADD_NEW_PLAYER:
                i++;
                serverPhysics.addPlayer(
                    data.player.name,
                    data.player.position,
                    data.player.rotation,
                    data.player.pitch
                );
                initiateNewPlayer(data, connections);
                break;

            case MessageTypeEnum.VERIFY_POSITION:
                console.log("VERIFY_POSITION");
                const result = serverPhysics.updatePlayerPosition(
                    data.player.name,
                    data.player.position,
                    data.player.rotation,
                    data.player.pitch
                );
                if (result.corrected) {
                    ws.send(JSON.stringify({
                        type: MessageTypeEnum.POSITION_CORRECTION,
                        position: result.position,
                        rotation: result.rotation,
                        pitch: result.pitch
                    }));
                }
                break;

            case MessageTypeEnum.UPDATE_PLAYER_KEYBINDS:  // Match the type from the client
                serverPhysics.updatePlayerMovement(
                    data.name, 
                    data.movement.forward,
                    data.movement.side,
                    data.movement.speed,
                    data.movement.isJumping
                );
                break;
        }
    };

    ws.onclose = () => {
        const index = connections.indexOf(ws);
        if (index !== -1) {
            connections.splice(index, 1);
        }
        serverPhysics.removePlayer(i.toString());
        console.log(`- websocket disconnected (${connections.length})`);
    };
});


app.use(router.routes());
app.use(router.allowedMethods());

await app.listen(options);

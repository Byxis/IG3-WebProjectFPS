import { Application, Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

const router = new Router();
const app = new Application();
const connections: WebSocket[] = [];
const players = {};

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
        console.log(data.type);
        console.log(data);

        if (data.type == "ADD_NEW_PLAYER")
        {
            const player = {
                name: data.player.name,
                position: data.player.position,
                rotation: data.player.rotation,
                pitch: data.player.pitch,
            };
            players[data.player.name] = player;
            console.log(player);

            i++;
            connections.forEach((ws) => {
                ws.send(JSON.stringify(
                    {
                        type: "NEW_PLAYER", player: player
                    }
                ));
            });
        }
        else if (data.type == "UPDATE_PLAYER")
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

        return
    };

    ws.onclose = () => {
        const index = connections.indexOf(ws);
        if (index !== -1) {
            connections.splice(index, 1);
        }
        console.log(`- websocket disconnected (${connections.length})`);
    };
});


app.use(router.routes());
app.use(router.allowedMethods());

await app.listen(options);

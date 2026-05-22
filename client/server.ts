import {
  Application,
  type ListenOptions,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";

const app = new Application();
const ROOT = `${Deno.cwd()}/`;

app.use(async (ctx) => {
  try {
    if (ctx.request.url.pathname === "/login") {
      await ctx.send({
        root: ROOT,
        path: "login.html",
      });
      return;
    }

    if (ctx.request.url.pathname === "/error") {
      await ctx.send({
        root: ROOT,
        path: "error.html",
      });
      return;
    }

    await ctx.send({
      root: ROOT,
      index: "index.html",
    });
  } catch {
    ctx.response.status = 404;
    ctx.response.body = "Error 404";
  }
});

const envPort = Deno.env.get("PORT");
if (Deno.args.length < 1 && !envPort) {
  console.log(
    `Usage: $ deno run --allow-net --allow-read=./ server.ts PORT [CERT_PATH KEY_PATH]`,
  );
  Deno.exit();
}

const port = Deno.args[0] ? Number(Deno.args[0]) : Number(envPort);

let options: ListenOptions = {
  port: port,
};

if (Deno.args.length >= 3) {
  const certContent = await Deno.readTextFile(Deno.args[1]);
  const keyContent = await Deno.readTextFile(Deno.args[2]);

  options = {
    port: port,
    secure: true,
    cert: certContent,
    key: keyContent,
  } as ListenOptions;
  console.log(`SSL conf ready (use https)`);
} else {
  options = {
    // Dokku proxy will handle SSL
    port: port,
  };
}

console.log(
  `Oak static server running on port ${options.port} for the files in ${ROOT}`,
);

console.log(
  `Oak static server running on port ${options.port} for the files in ${ROOT}`,
);
await app.listen(options);

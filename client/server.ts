import { Application, type ListenOptions } from "https://deno.land/x/oak@v12.6.1/mod.ts";

const app = new Application();
const ROOT = `${Deno.cwd()}/`;

app.use(async (ctx) => {
  try {
    await ctx.send({
      root: ROOT,
      index: "index.html",
    });
  } catch {
    ctx.response.status = 404;
    ctx.response.body = "Error 404";
  }
});

if (Deno.args.length < 1) {
  console.log(
    `Usage: $ deno run --allow-net --allow-read=./ server.ts PORT [CERT_PATH KEY_PATH]`,
  );
  Deno.exit();
}

let options: ListenOptions = { 
  port: Number(Deno.args[0])
};

if (Deno.args.length >= 3) {
  const certContent = await Deno.readTextFile(Deno.args[1]);
  const keyContent = await Deno.readTextFile(Deno.args[2]);
  
  // For Oak v12.6.1, use cert and key instead of certFile and keyFile
  options = {
    port: Number(Deno.args[0]),
    secure: true,
    cert: certContent,
    key: keyContent,
  } as ListenOptions;
  console.log(`SSL conf ready (use https)`);
} else {
  options = { 
    port: Number(Deno.args[0]) 
  };
}

console.log(
  `Oak static server running on port ${options.port} for the files in ${ROOT}`,
);

console.log(
  `Oak static server running on port ${options.port} for the files in ${ROOT}`,
);
await app.listen(options);

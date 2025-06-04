import { spawn } from "bun";

const processOptions = (args: { package: string; port: number }) =>
  ({
    cmd: [
      "bun",
      "run",
      "--filter",
      args.package,
      "--elide-lines=0",
      "dev",
    ] as string[],
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      PORT: args.port.toString(),
    },
  }) as const;

const run = async () => {
  // Spawn your web server processes
  const proxy = spawn(processOptions({ package: "proxy", port: 7272 }));
  const sp = spawn(processOptions({ package: "testsp", port: 7282 }));
  const idp = spawn(processOptions({ package: "testidp", port: 7292 }));

  // exit cleanup
  process.on("SIGINT", () => {
    console.log();
    console.log("Cleaning up...");
    proxy.kill();
    sp.kill();
    idp.kill();
  });

  // Keep the main process alive
  await Promise.all([sp.exited, idp.exited, proxy.exited]);
};

run();

import { spawn } from "bun";

const getEnvVar = (name: string): string => {
  if (!process.env[name]) {
    console.error(`Environment variable ${name} is not set`);
    process.exit(1);
  }
  return process.env[name];
};

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
  console.log("Starting the SAML Proxy test cluster (ctr-C to stop)");
  // Spawn the web server processes
  const proxy = spawn(
    processOptions({
      package: "proxy",
      port: parseInt(getEnvVar("SAML_PROXY_PORT")),
    }),
  );
  const sp = spawn(
    processOptions({
      package: "testsp",
      port: parseInt(getEnvVar("TEST_SP_PORT")),
    }),
  );
  const idp = spawn(
    processOptions({
      package: "testidp",
      port: parseInt(getEnvVar("TEST_IDP_PORT")),
    }),
  );

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

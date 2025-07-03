import * as fs from "fs";
import * as path from "path";

const run = async () => {
  const cwd = process.cwd();

  // if the .env file doesn't exist create it by copying .env.template
  const envFilePath = path.join(cwd, ".env");
  const templateFilePath = path.join(cwd, ".env.template");

  if (!fs.existsSync(envFilePath)) {
    console.log(`Creating .env file from .env.template`);
    let envTemplate = fs.readFileSync(templateFilePath, "utf8");
    // find all occurances of the string "{{replace-random}}" and replace with a randomly
    // genrated string.
    while (envTemplate.includes("{{replace-random}}")) {
      const randomString = btoa(
        String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
      );
      envTemplate = envTemplate.replace("{{replace-random}}", randomString);
    }
    fs.writeFileSync(envFilePath, envTemplate);
  }
};

run();

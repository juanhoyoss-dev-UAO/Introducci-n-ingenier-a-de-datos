import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;
const SALT_LENGTH = 16;

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Este comando requiere una terminal interactiva.");
  }

  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stderr.write("\n");
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Operación cancelada."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") {
          value += character;
        }
      }
    }

    process.stdin.on("data", onData);
  });
}

async function main() {
  if (process.argv.length > 2) {
    throw new Error("La contraseña no debe proporcionarse como argumento.");
  }

  const password = await readHidden("Contraseña del administrador: ");
  const confirmation = await readHidden("Confirma la contraseña: ");
  if (password !== confirmation) {
    throw new Error("Las contraseñas no coinciden.");
  }
  if (password.length < 12) {
    throw new Error("La contraseña debe tener al menos 12 caracteres.");
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
  process.stdout.write(
    [
      "scrypt",
      "v1",
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString("base64url"),
      derivedKey.toString("base64url"),
    ].join(":") + "\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Error inesperado."}\n`);
  process.exitCode = 1;
});

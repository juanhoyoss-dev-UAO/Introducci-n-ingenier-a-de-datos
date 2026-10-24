import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const HASH_SCHEME = "scrypt";
const HASH_VERSION = "v1";
const SCRYPT_COST = 32_768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const SALT_LENGTH = 16;

export class PasswordHashConfigurationError extends Error {
  constructor() {
    super("El hash de contraseña no tiene un formato válido.");
    this.name = "PasswordHashConfigurationError";
  }
}

interface ParsedPasswordHash {
  salt: Buffer;
  derivedKey: Buffer;
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new PasswordHashConfigurationError();
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    throw new PasswordHashConfigurationError();
  }
  return decoded;
}

function parsePasswordHash(encodedHash: string): ParsedPasswordHash {
  const [scheme, version, cost, blockSize, parallelization, salt, derivedKey, ...rest] =
    encodedHash.split(":");

  if (
    rest.length > 0 ||
    scheme !== HASH_SCHEME ||
    version !== HASH_VERSION ||
    cost !== String(SCRYPT_COST) ||
    blockSize !== String(SCRYPT_BLOCK_SIZE) ||
    parallelization !== String(SCRYPT_PARALLELIZATION) ||
    !salt ||
    !derivedKey
  ) {
    throw new PasswordHashConfigurationError();
  }

  const decodedSalt = decodeBase64Url(salt);
  const decodedKey = decodeBase64Url(derivedKey);
  if (
    decodedSalt.length !== SALT_LENGTH ||
    decodedKey.length !== SCRYPT_KEY_LENGTH
  ) {
    throw new PasswordHashConfigurationError();
  }

  return { salt: decodedSalt, derivedKey: decodedKey };
}

export function assertValidPasswordHash(encodedHash: string) {
  parsePasswordHash(encodedHash);
}

async function derivePasswordKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export async function createPasswordHash(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await derivePasswordKey(password, salt);
  return [
    HASH_SCHEME,
    HASH_VERSION,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join(":");
}

export async function verifyPassword(password: string, encodedHash: string) {
  const { salt, derivedKey } = parsePasswordHash(encodedHash);
  const candidateKey = await derivePasswordKey(password, salt);
  return timingSafeEqual(candidateKey, derivedKey);
}

export function constantTimeTextEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

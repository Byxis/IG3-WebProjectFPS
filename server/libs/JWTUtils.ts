import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import {
  create,
  getNumericDate,
  verify,
} from "https://deno.land/x/djwt@v2.9.1/mod.ts";

const SECRET_KEY_FILE = "./config/.jwt-secret.key";
export const ACCESS_TOKEN_EXP = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_EXP = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 ** Generates a cryptographically secure key for JWT signing
 * @returns {Promise<CryptoKey>} Generated key
 */
async function generateSecretKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-512" },
    true,
    ["sign", "verify"],
  );
}

/**
 ** Saves the secret key to a file
 * @param {CryptoKey} key - The key to save
 * @returns {Promise<void>}
 */
async function saveSecretKey(key: CryptoKey): Promise<void> {
  try {
    try {
      await Deno.mkdir("./config", { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }

    const jwk = await crypto.subtle.exportKey("jwk", key);
    const jwkString = JSON.stringify(jwk);

    await Deno.writeTextFile(SECRET_KEY_FILE, jwkString);
  } catch (error) {
    console.error("Error saving the secret key:", error);
  }
}

/**
 ** Loads the secret key from a file
 * @returns {Promise<CryptoKey|null>} The loaded key or null if not found
 */
async function loadSecretKey(): Promise<CryptoKey | null> {
  try {
    try {
      await Deno.stat(SECRET_KEY_FILE);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return null;
      }
      throw error;
    }

    const jwkString = await Deno.readTextFile(SECRET_KEY_FILE);
    const jwk = JSON.parse(jwkString);

    return await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "HMAC", hash: "SHA-512" },
      true,
      ["sign", "verify"],
    );
  } catch (error) {
    console.error("❌ Error loading the secret key:", error);
    return null;
  }
}

export const secretKey = await (async (): Promise<CryptoKey> => {
  let key = await loadSecretKey();
  if (!key) {
    console.log("- Secret key created 🧩");
    key = await generateSecretKey();
    await saveSecretKey(key);
  } else {
    console.log("- Secret key loaded ✅");
  }
  return key;
})();

/**
 ** Hashes a password using bcrypt
 * @param {string} password - The plain password
 * @returns {Promise<string>} Hashed password
 */
export async function getHash(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

/**
 ** Creates a JWT token
 * @param {Record<string, unknown>} payload - The data to include in the token
 * @param {number} expiresIn - Expiration time in milliseconds
 * @param {string} type - Token type (default: "access")
 * @returns {Promise<string>} JWT token
 */
export async function createJWT(
  payload: Record<string, unknown>,
  expiresIn: number,
  type: string = "access",
) {
  const key = secretKey;
  console.log(new Date(Date.now()));
  console.log(new Date(Date.now() + expiresIn));
  const date = new Date();
  const exp = getNumericDate(date.getTime() + expiresIn);

  const jwt = await create(
    { alg: "HS512", typ: "JWT" },
    { ...payload, exp, type },
    key,
  );

  return jwt;
}

/**
 ** Compares a plain password with a hash
 * @param {string} password - The plain password
 * @param {string} hash - The password hash
 * @returns {Promise<boolean>} True if password matches
 */
export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Define the payload interface
export type JWTPayload = {
  userId: number;
  username: string;
  role: string;
  exp: number;
  type: string;
};

/**
 ** Verifies a JWT token
 * @param {string} token - The token to verify
 * @returns {Promise<JWTPayload | null>} Decoded token payload or null if invalid
 */
export async function verifyJWT(
  token: string,
): Promise<JWTPayload | null> {
  try {
    if (!token || token === "undefined" || token === "null") {
      return null;
    }

    token = token.trim();
    const payload = await verify(token, secretKey) as JWTPayload;
    return payload;
  } catch (error) {
    console.log("Verify token failed:", error);
    return null;
  }
}

/**
 ** Checks if a token is authorized for a user
 * @param {Record<string, string>} tokens - Token to username mapping
 * @param {string} auth_token - Token to verify
 * @returns {Promise<boolean>} True if token is authorized
 */
export const isAuthorized = async (
  tokens: Record<string, string>,
  auth_token: string,
) => {
  if (!auth_token) {
    return false;
  }

  if (auth_token in tokens) {
    try {
      const payload = await verify(auth_token, secretKey);

      if (payload.username === tokens[auth_token]) {
        return true;
      }
    } catch (error) {
      console.log("Verify token failed:", error);
      return false;
    }
  }
  return false;
};

/**
 ** Creates a pair of access and refresh tokens
 * @param {Record<string, unknown>} payload - The payload to include in tokens
 * @returns {Promise<{accessToken: string, refreshToken: string}>} Token pair
 */
export async function createTokenPair(
  payload: Record<string, unknown>,
) {
  const accessToken = await createJWT(payload, ACCESS_TOKEN_EXP, "access");
  const refreshToken = await createJWT(payload, REFRESH_TOKEN_EXP, "refresh");

  return {
    accessToken,
    refreshToken,
  };
}

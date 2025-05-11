import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

const SECRET_KEY_FILE = "./config/.jwt-secret.key";
export const ACCESS_TOKEN_EXP = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_EXP = 7 * 24 * 60 * 60 * 1000; // 7 days

async function generateSecretKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-512" },
    true,
    ["sign", "verify"]
  );
}

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
      ["sign", "verify"]
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

export async function getHash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
}

export async function createJWT(payload: any, expiresIn: number, type: string = "access") {
  const key = secretKey;
  console.log(new Date(Date.now()))
  console.log(new Date(Date.now() + expiresIn))
  const date = new Date();
  const exp = getNumericDate(date.getTime() + expiresIn);
  
  const jwt = await create(
    { alg: "HS512", typ: "JWT" },
    { ...payload, exp, type },
    key
  );
  
  return jwt;
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

export async function verifyJWT(token: string): Promise<any> {
    try {
        if (!token || token === 'undefined' || token === 'null') {
            console.log("Invalid token format received");
            return null;
        }
        
        token = token.trim();
        const payload = await verify(token, secretKey);
        return payload;
    } catch (error) {
        console.log("Verify token failed:", error);
        return null;
    }
}

export const is_authorized = async (tokens, auth_token: string) => {
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
  
    console.log("Unknown token");
    return false;
};
  
export async function createTokenPair(payload: any) {
  
  const accessToken = await createJWT(payload, ACCESS_TOKEN_EXP, "access");
  const refreshToken = await createJWT(payload, REFRESH_TOKEN_EXP, "refresh");
  
  return {
    accessToken,
    refreshToken
  };
}
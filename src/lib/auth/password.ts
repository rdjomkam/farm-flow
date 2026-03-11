import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

/** Hash a password using bcrypt with cost factor 12 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** Verify a password against a bcrypt hash */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

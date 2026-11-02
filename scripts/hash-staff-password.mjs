import { pbkdf2Sync, randomBytes } from "node:crypto";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");

if (password.length < 12 || password.length > 128) {
  process.stderr.write("Password must be between 12 and 128 characters.\n");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 310000, 32, "sha256");
process.stdout.write(salt.toString("base64url") + "." + hash.toString("base64url") + "\n");

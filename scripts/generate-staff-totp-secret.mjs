import { randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(bytes) {
  let buffer = 0;
  let bits = 0;
  let output = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += alphabet[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

const staffEmail = process.argv[2]?.trim().toLowerCase();
if (!staffEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) {
  process.stderr.write("Usage: node scripts/generate-staff-totp-secret.mjs staff@example.com\n");
  process.exit(1);
}

const secret = encodeBase32(randomBytes(20));
const issuer = "Damien's Smoky Kitchen";
const label = encodeURIComponent(`${issuer}:${staffEmail}`);
const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

process.stdout.write("Create this account in your authenticator app using the setup key below.\n");
process.stdout.write("Issuer: " + issuer + "\n");
process.stdout.write("Account: " + staffEmail + "\n");
process.stdout.write("Secret key: " + secret + "\n");
process.stdout.write("otpauth URI: " + uri + "\n\n");
process.stdout.write("Store the secret in Cloudflare as STAFF_TOTP_SECRET. Never commit it or send it in chat.\n");

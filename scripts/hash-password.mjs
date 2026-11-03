// Usage: npm run hash -- "your new password"   -> prints a value for the ADMIN_PASSWORD_HASH env var
import { hashPassword } from '../lib/auth.js';
const pw = process.argv[2];
if (!pw || pw.length < 12) {
  console.error('Provide a password of at least 12 characters: npm run hash -- "your password"');
  process.exit(1);
}
console.log(hashPassword(pw));

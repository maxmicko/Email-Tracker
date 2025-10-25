const crypto = require('crypto');
const SECRET = process.env.TRACK_SECRET || 'change_this_secret';
function signString(str) {
  return crypto.createHmac('sha256', SECRET).update(str).digest('hex');
}
function verifyString(str, sig) {
  if (!str || !sig) return false;
  const mac = signString(str);
  try {
    const a = Buffer.from(mac, 'hex');
    const b = Buffer.from(sig, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
module.exports = { signString, verifyString };
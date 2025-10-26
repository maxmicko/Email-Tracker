const { signString } = require('./signer');
const { v4: uuidv4 } = require('uuid');
const BASE = process.env.APP_BASE || 'https://email-tracker-flax-psi.vercel.app/';
function generate(message) {
  const id = message.id || uuidv4();
  const links = message.links || [];
  const linksMap = {};
  links.forEach((u, i) => { linksMap[i] = u; });
  const wrappedLinks = links.map((u, i) => {
    const sig = signString(`m=${id}|l=${i}`);
    return `${BASE}/click?m=${id}&l=${i}&sig=${sig}`;
  });
  const pixelSig = signString(`m=${id}`);
  const pixelUrl = `${BASE}/pixel.gif?m=${id}&sig=${pixelSig}`;
  let html = message.htmlBody || '<p>Open this message.</p>';
  wrappedLinks.forEach((wl, i) => { html = html.replace(new RegExp(`{{link${i}}}`, 'g'), wl); });
  html += `\n<img src="${pixelUrl}" width="1" height="1" style="display:block;max-height:1px;max-width:1px" alt="" />`;
  return { id, html, metadata: { links: linksMap } };
}
module.exports = { generate };
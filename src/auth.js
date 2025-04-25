import http from 'http';
import axios from 'axios';
import open from 'open';
import { randomBytes, createHash } from 'crypto';
import 'dotenv/config';

function base64URLEncode(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest();
}

export async function interactiveLogin() {
  const clientId = 'mangadex-frontend-stable';
  const redirectUri = 'http://localhost:3000/auth/login?afterAuthentication=/&shouldRedirect=true&wasPopup=false';

  // Create PKCE codes
  const codeVerifier = base64URLEncode(randomBytes(32));
  const codeChallenge = base64URLEncode(await sha256(codeVerifier));
  const state = base64URLEncode(randomBytes(16));

  // Build authorization URL
  const authUrl = `https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/auth?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email groups profile roles',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();

  console.log('→ Attempting to open browser for login');
  console.log('→ If it fails, please open this URL manually:\n', authUrl);
  await open(authUrl);

  // Start local server to handle the callback
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith('/auth/login')) return;

      const urlObj = new URL(req.url, 'http://localhost:3000');
      const returnedState = urlObj.searchParams.get('state');
      const code = urlObj.searchParams.get('code');

      if (returnedState !== state) {
        res.writeHead(400);
        res.end('State mismatch');
        return reject(new Error('State mismatch'));
      }

      try {
        // Exchange code for tokens
        const tokenRes = await axios.post(
          'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token',
          new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Login successful! You can close this window.');
        server.close();

        resolve(tokenRes.data); // { access_token, refresh_token, expires_in, ... }
      } catch (err) {
        res.writeHead(500);
        res.end('Token exchange failed. Check console for details.');
        server.close();
        reject(err);
      }
    });

    server.listen(3000);
  });
}

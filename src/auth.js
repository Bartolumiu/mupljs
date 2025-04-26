import http from 'http';
import axios from 'axios';
import open from 'open';
import { randomBytes, createHash } from 'crypto';
import 'dotenv/config';

const CLIENT_ID = process.env.CLIENT_ID || 'mangadex-frontend-stable';
const base64URLEncode = (buf) => {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const sha256 = (buffer) => {
  return createHash('sha256').update(buffer).digest();
}

const interactiveLogin = async () => {
  const redirectUri = 'http://localhost:3000/auth/login?afterAuthentication=/&shouldRedirect=true&wasPopup=false';

  // Create PKCE codes
  const codeVerifier = base64URLEncode(randomBytes(32));
  const codeChallenge = base64URLEncode(sha256(codeVerifier));
  const state = base64URLEncode(randomBytes(16));

  // Build authorization URL
  const authUrl = `https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/auth?` + new URLSearchParams({
    client_id: CLIENT_ID,
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
            client_id: CLIENT_ID,
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Login successful! You can close this window.');
        server.close();

        console.log(tokenRes.data);
        resolve({
          ...tokenRes.data,
          expires_at: Date.now() + (tokenRes.data.expires_in * 1000),
        }); // { access_token, refresh_token, expires_in, ... }
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

const refreshAccessToken = async (refreshToken) => {
  try {
    const res = await axios.post(
      'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return {
      ...res.data,
      expires_at: Date.now() + (res.data.expires_in * 1000),
    }; // { access_token, refresh_token, expires_in, ... }
  } catch (err) {
    console.error('❌ Failed to refresh access token:', err.response?.data || err.message);
    throw new Error('Failed to refresh access token');
  }
}

export { interactiveLogin, refreshAccessToken };
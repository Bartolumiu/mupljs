import { interactiveLogin } from './auth.js';

(async () => {
    try {
        const tokenSet = await interactiveLogin();
        console.log('✅ Auth OK, token:', tokenSet.access_token.slice(0, 10) + '...');
        console.log('→ Token expires in:', tokenSet.expires_in, 'seconds');
        console.log('→ Refresh token:', tokenSet.refresh_token.slice(0, 10) + '...');
        // TODO: Add upload chapters logic here
    } catch (err) {
        console.error('❌ Login failed:', err);
        process.exit(1);
    }
})();
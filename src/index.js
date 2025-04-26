import { interactiveLogin } from './auth.js';
import getChapters from './parsers/chapters.js';
import attachImagesToChapters from './parsers/images.js';

(async () => {
    try {
        const tokenSet = await interactiveLogin();
        console.log('✅ Auth OK, token:', tokenSet.access_token.slice(0, 10) + '...');
        console.log('→ Token expires in:', tokenSet.expires_in, 'seconds');
        console.log('→ Refresh token:', tokenSet.refresh_token.slice(0, 10) + '...');

          const chapters = await getChapters();
        console.log('📚 Chapters fetched:', chapters.length);

        await attachImagesToChapters(chapters);
    } catch (err) {
        console.error('❌ Login failed:', err);
        process.exit(1);
    }
})();
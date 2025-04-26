import { interactiveLogin } from './auth.js';
import getChapters from './parsers/chapters.js';
import attachImagesToChapters from './parsers/images.js';
import validateChapterImages from './parsers/validate.js';
import uploadChapter from './uploader/upload.js';

(async () => {
    try {
        // Authentication
        const tokenSet = await interactiveLogin();
        const token = tokenSet.access_token;
        console.log('✅ Auth OK, token:', token.slice(0, 10) + '...');

        // Parse & fetch chapters
        const chapters = await getChapters();
        console.log('📚 Chapters fetched:', chapters.length);

        // Attach images to chapters
        await attachImagesToChapters(chapters);

        // Validate chapter images
        for (const chapter of chapters) {
            console.log(`Validating chapter images for: ${chapter.chapterPath}`);
            const { valid, optimizedImages, totalSize, reason } = await validateChapterImages(chapter);
            if (!valid) {
                console.log(`❌ Validation failed for ${chapter.chapterPath}: ${reason}`);
                continue; // Skip to the next chapter if validation fails
            }

            chapter.imageFiles = optimizedImages;
        }
        console.log('✅ All chapters validated successfully.');

        const sanitizeValue = (str) => {
            if (str === null) return null;
            const raw = String(str).trim().toLowerCase();

            const m = /^((?:0|[1-9]\d*)(?:\.\d{1,2})?)([a-z])?$/i.exec(raw);
            if (!m) return null;

            const num = parseFloat(m[1]);
            const normalizedNum = String(num);

            return m[2] ? normalizedNum + m[2].toLowerCase() : normalizedNum;
        }
        // Upload chapters
        console.log('📤 Uploading chapters...');
        for (const chapter of chapters) {
            if (!chapter.imageFiles || chapter.imageFiles.length === 0) {
                console.log(`❌ Skipping ${chapter.chapterPath}: No images found`);
                continue; // Skip to the next chapter if no valid images
            }

            const draft = {
                volume: sanitizeValue(chapter.volume),
                chapter: sanitizeValue(chapter.chapter),
                translatedLanguage: chapter.lang,
                title: chapter.title
            };
            
            const chapterId = await uploadChapter({ mangaId: chapter.titleId, groupIds: chapter.groups }, chapter.imageFiles, draft, token);

            console.log(`✅ Chapter uploaded successfully. Chapter ID: ${chapterId}`);
        }
        console.log('✅ All chapters uploaded successfully.');
    } catch (err) {
        console.error('❌ Execution error:', err);
        process.exit(1);
    }
})();
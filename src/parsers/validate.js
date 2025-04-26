import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const MAX_WIDTH = 10000;
const MAX_HEIGHT = 10000;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_CHAPTER_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_IMAGES_PER_CHAPTER = 500; // Maximum number of images per chapter from the API documentation

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];
const CONVERTIBLE_EXTENSIONS = ['.webp', '.bmp', '.tiff', '.heic', '.heif', '.jxl'];

const validateAndOptimizeImage = async (filePath) => {
    let buffer = await fs.readFile(filePath);
    let ext = path.extname(filePath).toLowerCase();
    let shouldConvert = !ALLOWED_EXTENSIONS.includes(ext) && CONVERTIBLE_EXTENSIONS.includes(ext);

    if (buffer.length === 0) {
        console.log(`❌ Empty image file: ${filePath}`);
        return { valid: false, reason: 'Empty image file', filePath };
    }

    const image = sharp(buffer, { animated: ext === '.gif' });
    const metadata = await image.metadata();

    const frameHeight = metadata.pages && metadata.pageHeight ? metadata.pageHeight : metadata.height;
    const frameWidth = metadata.pages && metadata.pageWidth ? metadata.pageWidth : metadata.width;

    if (frameWidth > MAX_WIDTH || frameHeight > MAX_HEIGHT) {
        console.log(`❌ Image dimensions exceed limits: ${filePath} (${metadata.width}x${metadata.height})`);
        return { valid: false, reason: 'Image dimensions exceed limits', filePath };
    }

    if (shouldConvert || buffer.length > MAX_IMAGE_SIZE) {
        const outputFormat = metadata.hasAlpha ? 'png' : 'jpeg';
        buffer = await image[outputFormat]({ quality: 80, progressive: true, force: true }).toBuffer();
        ext = outputFormat === 'jpeg' ? '.jpg' : '.png';
    }

    return {
        buffer,
        ext,
        originalPath: filePath,
        finalSize: buffer.length,
        valid: buffer.length <= MAX_IMAGE_SIZE
    };
};

const validateChapterImages = async (chapter) => {
    const { chapterPath, images } = chapter;
    const validatedImages = [];

    if (!images || images.length === 0) {
        console.log(`❌ No images found for chapter: ${chapterPath}`);
        return { valid: false, reason: 'No images found' };
    }

    if (images.length > MAX_IMAGES_PER_CHAPTER) {
        console.log(`❌ Too many images for chapter: ${chapterPath} (${images.length} images)`);
        return { valid: false, reason: 'Too many images' };
    }

    let totalSize = 0;
    for (const imgPath of images) {
        try {
            const result = await validateAndOptimizeImage(imgPath);

            if (!result.valid) {
                console.log(`❌ Invalid image size: ${imgPath} (${result.finalSize ?? 0} bytes)`);
                return { valid: false, reason: 'One of the images is either too big or is empty' };
            };

            validatedImages.push({
                buffer: result.buffer,
                ext: result.ext,
                originalPath: imgPath
            });

            totalSize += result.finalSize;
        } catch (err) {
            console.error(`❌ Error processing image: ${imgPath}`, err);
            return { valid: false, reason: `Error processing image ${imgPath}` };
        };
    };

    if (totalSize > MAX_CHAPTER_SIZE) {
        console.log(`❌ Chapter size exceeds limit: ${chapterPath} (${totalSize} bytes)`);
        return { valid: false, reason: 'Chapter size exceeds limit' };
    };

    return {
        valid: true,
        optimizedImages: validatedImages,
        totalSize
    };
};

export default validateChapterImages;
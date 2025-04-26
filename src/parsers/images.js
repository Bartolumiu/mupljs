import fs from 'fs/promises';
import path from 'path';
import loadFile from '../handlers/files.js';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const isImageFile = (filename) => {
    return IMAGE_EXTENSIONS.includes(path.extname(filename).toLowerCase());
};

const naturalSort = (files) => {
    return files.sort((a, b) => {
        const nameA = path.parse(a).name;
        const nameB = path.parse(b).name;

        const numA = parseInt(nameA.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(nameB.match(/\d+/)?.[0] || '0', 10);

        const isNumA = !isNaN(numA);
        const isNumB = !isNaN(numB);

        if (isNumA && isNumB) {
            return numA - numB;
        }

        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    })
}

const attachImagesToChapters = async (chapters) => {
    const { chapter_root } = await loadFile('config');
    for (const chapter of chapters) {
        const folderPath = path.join(chapter_root, chapter.chapterPath);
        let files;

        try {
            files = await fs.readdir(folderPath);
        } catch (err) {
            console.error(`❌ Failed to read directory: ${folderPath}`, err);
            continue;
        }

        const imageFiles = files.filter(isImageFile).map(f => path.join(folderPath, f));

        if (imageFiles.length === 0) {
            console.log(`❌ No images found in: ${folderPath}`);
            continue;
        }

        const sortedImageFiles = naturalSort(imageFiles);

        chapter.images = sortedImageFiles;
    }
}

export default attachImagesToChapters;
import fs from 'fs/promises';
import path from 'path';

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
    for (const chapter of chapters) {
        const folderPath = chapter.filePath;
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

    // DEBUG: Update the parsed_chapters.json file with images (will be removed in final version)
    await fs.writeFile(path.join(process.cwd(), 'parsed_chapters.json'), JSON.stringify(chapters, null, 2));
    console.log(`\nDEBUG: Images attached to chapters and saved to parsed_chapters.json`);
}

export default attachImagesToChapters;
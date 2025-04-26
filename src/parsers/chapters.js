import fs from 'fs/promises';
import path from 'path';
import loadFile from '../handlers/files.js';

const SPECIAL_CHAR_MAP = {
    '{asterisk}': '*',
    '{backslash}': '\\',
    '{slash}': '/',
    '{colon}': ':',
    '{greater}': '>',
    '{less}': '<',
    '{question}': '?',
    '{quote}': '"',
    '{pipe}': '|'
};

const restoreChapterName = (input) => {
    return Object.entries(SPECIAL_CHAR_MAP).reduce((str, [key, val]) => str.replaceAll(key, val), input);
}

const parseChapterName = (input) => {
    const regex = /^(.+?)\s+(?:\[(\w{2})\]\s+)?-\s+(.+?)(?:\s+\(v(\d+)\))?(?:\s+\((.+?)\))?(?:\s+\{(.+?)\})?(?:\s+\[(.+?)\])?$/;
    const match = input.match(regex);

    if (!match) return null;

    const [ _, rawTitle, langCode, rawChapter, volume, chapterTitle, publishDate, rawGroups ] = match;

    const chapter = rawChapter.trim();
    const isOneshot = !/^c\d/.test(chapter);
    const cleanedChapter = chapter.startsWith('c') ? chapter.slice(1) : null;

    return {
        isOneshot,
        title: rawTitle.trim(),
        lang: langCode ? langCode.trim() : 'en',
        chapter: cleanedChapter,
        volume: volume ? volume.trim() : null,
        chapterTitle: chapterTitle ? restoreChapterName(chapterTitle.trim()) : null,
        publishDate: publishDate ? publishDate.trim() : null,
        groups: rawGroups ? rawGroups.split('+').map(g => g.trim()) : [],
    };
}

const isUUIDv4 = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const getChapters = async () => {
    const { chapter_root } = await loadFile('config');
    const nameIdMap = await loadFile('map');

    const entries = await fs.readdir(chapter_root, { withFileTypes: true });
    const parsedChapters = [];

    for (const entry of entries) {
        const name = path.basename(entry.name, path.extname(entry.name));
        const parsed = parseChapterName(name);

        if (!parsed) {
            console.log(`❌ Skipped: ${entry.name}`);
            continue;
        }

        const titleId = nameIdMap.titles[parsed.title];
        const titleIdValid = titleId || (isUUIDv4(parsed.title) ? parsed.title : null);
        if (!titleIdValid) {
            console.log(`❌ Invalid title ID for: ${entry.name}`);
            continue;
        }

        const groupIds = [];
        let invalidGroup = false;
        for (const group of parsed.groups) {
            const groupId = nameIdMap.groups[group];
            if (groupId) {
                groupIds.push(groupId);
            } else if (isUUIDv4(group)) {
                groupIds.push(group);
            } else {
                console.log(`❌ Invalid group ID for: ${entry.name} -> ${group}`);
                invalidGroup = true;
                break;
            }
        }
        if (invalidGroup) continue;
        const chapterData = {
            chapterPath: name,
            titleId,
            lang: parsed.lang,
            chapter: parsed.chapter,
            volume: parsed.volume,
            title: parsed.chapterTitle,
            publishDate: parsed.publishDate,
            groups: groupIds,
            isOneshot: parsed.isOneshot,
            images: [],
            imageFiles: []
        };

        parsedChapters.push(chapterData);
        console.log(`✅ Parsed: ${entry.name} -> ${JSON.stringify(chapterData)}`);
    }
    return parsedChapters;
}

export default getChapters;
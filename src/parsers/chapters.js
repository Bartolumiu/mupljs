import fs from 'fs/promises';
import path from 'path';

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

const loadFile = async (fileName) => {
    switch (fileName) {
        case 'config':
            return await loadConfig();
        case 'map':
            return await loadMap();
        default:
            throw new Error(`Unknown file name: ${fileName}`);
    }
}

const loadConfig = async () => {
    const raw = await fs.readFile(path.join(process.cwd(), 'config.json'));
    const config = JSON.parse(raw);
    if (!config) throw new Error('Config file not found or invalid JSON format.');
    return config;
}

const loadMap = async () => {
    const raw = await fs.readFile(path.join(process.cwd(), 'name_id_map.json'));
    const map = JSON.parse(raw);
    if (!map) throw new Error('Map file not found or invalid JSON format.');
    return map;
}

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
    const { chapterRoot } = await loadFile('config');
    const nameIdMap = await loadFile('map');

    const entries = await fs.readdir(chapterRoot, { withFileTypes: true });
    const parsedChapters = [];

    for (const entry of entries) {
        const name = path.basename(entry.name, path.extname(entry.name));
        const fullPath = path.join(chapterRoot, entry.name);
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
            filePath: fullPath,
            titleId,
            lang: parsed.lang,
            chapter: parsed.chapter,
            volume: parsed.volume,
            title: parsed.chapterTitle,
            publishDate: parsed.publishDate,
            groups: groupIds,
            isOneshot: parsed.isOneshot,
            images: []
        };

        parsedChapters.push(chapterData);
        console.log(`✅ Parsed: ${entry.name} -> ${JSON.stringify(chapterData)}`);
    }

    await fs.writeFile(path.join(process.cwd(), 'parsed_chapters.json'), JSON.stringify(parsedChapters, null, 2));
    console.log(`\nParsed chapters saved to parsed_chapters.json`);
    console.log(`Total chapters parsed: ${parsedChapters.length}`);

    return parsedChapters;
}

export default getChapters;

getChapters().catch(console.error);
import fs from 'fs/promises';
import path from 'path';

const loadFile = async (filename) => {
    switch (filename) {
        case 'config':
            return await loadConfig();
        case 'map':
            return await loadMap();
        default:
            throw new Error(`Unknown file name: ${filename}`);
    };
};

const loadConfig = async () => {
    const raw = await fs.readFile(path.join(process.cwd(), 'config.json'));
    const config = JSON.parse(raw);
    if (!config) throw new Error('Config file not found or invalid JSON format.');
    return config;
};

const loadMap = async () => {
    const raw = await fs.readFile(path.join(process.cwd(), 'name_id_map.json'));
    const map = JSON.parse(raw);
    if (!map) throw new Error('Map file not found or invalid JSON format.');
    return map;
};

export default loadFile;
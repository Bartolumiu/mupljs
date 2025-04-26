import axios from 'axios';
import path from 'path';
import loadFile from '../handlers/files.js';
import FormData from 'form-data';

const config = await loadFile('config');
const { mangadex_api } = config;

const UPLOAD_BASE = `${mangadex_api}/upload`;
const MAX_BATCH_SIZE = 10; // Maximum number of files per request

const beginUploadSession = async ({ mangaId, groupIds }, token) => {
    try {
        const res = await axios.post(
            `${UPLOAD_BASE}/begin`,
            { manga: mangaId, groups: groupIds },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return res.data.data.id; // Upload session ID
    } catch (err) {
        if (err.response?.status === 409) {
            console.error('❌ Upload session already exists:', err.response.data.errors[0].detail);
            throw new Error('Upload session already exists');
        } else {
            console.error('❌ Failed to begin upload session:', err.response?.data || err.message);
            throw new Error('Failed to begin upload session');
        };
    };
};

const getActiveUploadSession = async (token) => {
    try {
        const res = await axios.get(UPLOAD_BASE, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return res.data.data.id; // Active upload session ID
    } catch (err) {
        if (err.response?.status === 404) return null; // No active upload session
        throw err;
    };
};

const abortUploadSession = async (sessionId, token) => {
    await axios.delete(`${UPLOAD_BASE}/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
};

const uploadImageBatch = async (sessionId, images, token) => {
    const form = new FormData();
    images.forEach((img, idx) => {
        const filename = path.basename(img.originalPath);
        form.append(`file${idx + 1}`, img.buffer, { filename });
    });

    const res = await axios.post(`${UPLOAD_BASE}/${sessionId}`, form, {
        headers: {
            Authorization: `Bearer ${token}`,
            ...form.getHeaders()
        }
    });

    return res.data.data.map((f) => ({
        id: f.id,
        filename: f.attributes.originalFileName
    }));
};

const commitUploadSession = async (sessionId, chapterDraft, pageOrder, token) => {
    try {
        const res = await axios.post(
            `${UPLOAD_BASE}/${sessionId}/commit`,
            { chapterDraft, pageOrder },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return res.data.data.id; // Chapter ID
    } catch (err) {
        if (err.response?.status === 409) {
            console.error('❌ Upload session already exists:', err.response.data.errors[0].detail);
            throw new Error('Upload session already exists');
        } else {
            console.error('❌ Failed to commit upload session:', err.response?.data || err.message);
            throw new Error('Failed to commit upload session');
        };
    }
}

const uploadChapter = async ({ mangaId, groupIds }, images, chapterDraft, token) => {
    let sessionId = await getActiveUploadSession(token);
    if (sessionId) {
        await abortUploadSession(sessionId, token);
        console.log('❌ Aborted previous upload session:', sessionId);
    }

    sessionId = await beginUploadSession({ mangaId, groupIds }, token);
    console.log(`📤 Upload session started: ${sessionId}`);

    const pageMap = [];
    for (let i = 0; i < images.length; i += MAX_BATCH_SIZE) {
        const batch = images.slice(i, i + MAX_BATCH_SIZE);
        const uploaded = await uploadImageBatch(sessionId, batch, token);
        pageMap.push(...uploaded);
    }

    pageMap.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' }));
    const pageOrder = pageMap.map((f) => f.id);

    const chapterId = await commitUploadSession(sessionId, chapterDraft, pageOrder, token);
    return chapterId;
}

export default uploadChapter;
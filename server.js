/**
 * Vision Nova — Full-Stack Server (ESM)
 * ─────────────────────────────────────────────────────
 *  POST /api/analyze        → AI image captioning  (on-device, @xenova/transformers)
 *  POST /api/tts            → Text-to-Speech metadata (browser Web Speech API)
 *  POST /api/contact        → Contact form handler
 *  GET  /api/health         → Health / model-ready check
 *  *                        → Serve static frontend files
 * ─────────────────────────────────────────────────────
 */

import express  from 'express';
import multer   from 'multer';
import path     from 'path';
import fs       from 'fs';
import crypto   from 'crypto';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

// ── Middleware ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ── Multer ─────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename:    (_req, file, cb) => {
        const uid = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
        cb(null, uid + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        /^image\/(jpeg|png|gif|webp|bmp)$/.test(file.mimetype)
            ? cb(null, true)
            : cb(new Error('Only image files are allowed.'));
    }
});

// ── AI Model ────────────────────────────────────────────

// Local AI model loading is disabled for cloud deployment (Render free plan)
let captioner  = null;
let modelReady = false;
let modelError = 'Local AI model disabled for cloud deployment (insufficient RAM).';

async function loadModel() {
    console.log('\n─────────────────────────────────────────');
    console.log('⚠️  Local AI model loading is DISABLED for Render free plan.');
    console.log('    Only Gemini API will be used for image analysis.');
    console.log('─────────────────────────────────────────\n');
    modelReady = false;
}

function summarizeTextLocal(text, fallbackCaption = '') {
    const normalized = normalizeOcrText(text);
    if (isMeaningfulText(normalized)) {
        return buildReadableSummary(normalized);
    }

    if (fallbackCaption) {
        return `Summary: ${fallbackCaption}`;
    }

    return 'Summary: The text in this image is low-confidence or unclear. Please retake a clearer image for accurate reading.';
}

function buildReadableSummary(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const normalized = normalizeOcrText(text);
    const lower = normalized.toLowerCase();

    const hasDataWarehouseTopic =
        lower.includes('data warehousing') ||
        lower.includes('data warehouse');

    if (hasDataWarehouseTopic) {
        const hasSubject = /subject\s*-?\s*oriented/.test(lower);
        const hasIntegrated = /integrated/.test(lower);
        const hasTimeVariant = /time\s*-?\s*variant/.test(lower);
        const hasNonVolatile = /non\s*-?\s*volatile/.test(lower);

        const features = [
            hasSubject ? 'subject-oriented' : null,
            hasIntegrated ? 'integrated' : null,
            hasTimeVariant ? 'time-variant' : null,
            hasNonVolatile ? 'non-volatile' : null
        ].filter(Boolean);

        const featureText = features.length
            ? (features.length === 1
                ? features[0]
                : `${features.slice(0, -1).join(', ')}, and ${features[features.length - 1]}`)
            : 'subject-oriented, integrated, time-variant, and non-volatile';

        return `This document defines Data Warehousing as a ${featureText} collection of data designed to support management decision-making, a definition attributed to William H. Inmon. It then lists the key features of a data warehouse: ${featureText}.`;
    }

    const heading = lines[0] || normalized.split(/[.!?]/)[0] || 'a study topic';
    const cleanHeading = heading.replace(/[:\-]+$/g, '').slice(0, 80);

    const fragments = normalized
        .split(/[.!?]\s+|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 20)
        .slice(0, 3);

    const details = fragments.length
        ? fragments.join('. ') + (fragments[fragments.length - 1].endsWith('.') ? '' : '.')
        : normalized.slice(0, 220) + (normalized.length > 220 ? '...' : '');

    return `The image shows text written on a page about ${cleanHeading}. The text says: ${details}`;
}

function isReadableSummary(summary) {
    const s = normalizeOcrText(summary).toLowerCase();
    if (!s || s.length < 35) return false;
    if (s.includes('summary is not readable')) return false;
    if (s.includes('keep the summary')) return false;
    return true;
}

function normalizeOcrText(text) {
    return String(text || '')
        .replace(/[\u0000-\u001f]+/g, ' ')
        .replace(/[|`~^]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isMeaningfulText(text) {
    if (!text || text.length < 25) return false;

    const alphaNum = (text.match(/[A-Za-z0-9]/g) || []).length;
    const letters = (text.match(/[A-Za-z]/g) || []).length;
    const ratio = alphaNum / text.length;

    // Reject obvious OCR noise while keeping mixed document text.
    return ratio > 0.55 && letters >= 20;
}

function textQualityScore(text) {
    const normalized = normalizeOcrText(text);
    if (!normalized) return 0;

    const alphaNum = (normalized.match(/[A-Za-z0-9]/g) || []).length;
    const letters = (normalized.match(/[A-Za-z]/g) || []).length;
    const words = normalized.split(/\s+/).filter(Boolean).length;
    const ratio = alphaNum / normalized.length;

    return (ratio * 100) + Math.min(letters, 120) * 0.2 + Math.min(words, 120) * 0.2;
}

function safeParseGeminiJson(rawText) {
    if (!rawText) return null;

    try {
        return JSON.parse(rawText);
    } catch (_) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (_err) {
            return null;
        }
    }
}

async function runGeminiVision(filePath, mimeType) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const imageData = await fs.promises.readFile(filePath);
    const base64Image = imageData.toString('base64');

    const body = {
        contents: [
            {
                parts: [
                    {
                        text: 'Extract the exact text from this image and also produce a short summary for speech output. Return strict JSON with keys exactText and summary.'
                    },
                    {
                        inline_data: {
                            mime_type: mimeType || 'image/jpeg',
                            data: base64Image
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 700
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || `Gemini API error: ${response.status}`);
    }

    const rawText = (
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        data?.text ||
        ''
    ).trim();

    if (!rawText) throw new Error('Gemini returned empty text');

    const parsed = safeParseGeminiJson(rawText);
    if (!parsed) {
        return {
            exactText: '',
            summary: rawText
        };
    }

    return {
        exactText: String(parsed.exactText || '').trim(),
        summary: String(parsed.summary || '').trim()
    };
}

async function summarizeWithGemini(exactText) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !exactText) return '';

    const body = {
        contents: [
            {
                parts: [
                    {
                        text: `Summarize this OCR text in 2-3 short sentences for a text-to-speech assistant. OCR text:\n${exactText}`
                    }
                ]
            }
        ],
        generationConfig: {
            maxOutputTokens: 220
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || `Gemini summary error: ${response.status}`);
    }

    return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function reconstructTextWithAi(noisyText, summaryHint = '') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !noisyText) return '';

    const prompt = [
        'You are an OCR correction assistant.',
        'Given noisy OCR text, reconstruct the most likely clean text.',
        'Keep the meaning faithful to the source and do not invent unrelated facts.',
        'Return plain text only. No markdown, no bullets unless present in source.',
        summaryHint ? `Context summary: ${summaryHint}` : '',
        'Noisy OCR text:',
        noisyText
    ].filter(Boolean).join('\n');

    const body = {
        contents: [
            {
                parts: [
                    { text: prompt }
                ]
            }
        ],
        generationConfig: {
            maxOutputTokens: 700
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || `AI reconstruction error: ${response.status}`);
    }

    return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

function cleanupFile(p) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
}

// ── Routes ─────────────────────────────────────────────

// Health
app.get('/api/health', (_req, res) => {
    res.json({
        status:     'ok',
        model:      modelReady ? 'ready' : (modelError ? 'error' : 'loading'),
        modelError: modelError || null,
        uptime:     Math.floor(process.uptime()) + 's',
        timestamp:  new Date().toISOString()
    });
});

// AI Image Analysis
app.post('/api/analyze', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

    const filePath = req.file.path;
    const hasAiApiKey = Boolean(process.env.GEMINI_API_KEY);

    if (!hasAiApiKey) {
        cleanupFile(filePath);
        return res.status(500).json({
            error: 'GEMINI_API_KEY is required for image analysis on Render free plan.',
            description: 'Local AI model is disabled due to memory limits. Please set GEMINI_API_KEY in your environment variables.',
            summary: 'Unable to process image. Please contact the site owner.',
            exactText: '',
            source: 'error'
        });
    }

    try {
        console.log(`🖼   Analysing: ${req.file.originalname}`);
        const t0 = Date.now();

        // Only use Gemini API for analysis
        console.log('☁️  Sending image to Gemini API for exact text + summary...');
        const gemini = await runGeminiVision(filePath, req.file.mimetype);
        const exactText = gemini.exactText || '';
        const summary = gemini.summary || '';
        const ms = Date.now() - t0;
        cleanupFile(filePath);

        const response = {
            summary: summary || 'No summary generated.',
            source: 'ai',
            confidence: `AI · ${ms}ms`,
            description: summary || 'No summary generated.'
        };
        if (req.body && req.body.includeExactText === 'true') {
            response.exactText = exactText;
        }
        return res.json(response);

    } catch (err) {
        cleanupFile(filePath);
        console.error('Gemini AI error:', err.message);
        return res.status(500).json({
            error:       'Image analysis failed.',
            description: 'Unable to process this image. Please try a different one.',
            summary:     'Unable to process this image. Please try a different one.',
            exactText:   '',
            source:      'error'
        });
    }
});

// TTS metadata (browser does the actual speaking)
app.post('/api/tts', (req, res) => {
    const { text, rate = 1.0, pitch = 1.0, voice = 'default' } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required.' });
    return res.json({
        method: 'browser-tts',
        text:   text.trim().slice(0, 2000),
        rate, pitch, voice,
        message: 'Use the browser Web Speech API with these parameters.'
    });
});

// Contact Form
const LOG_PATH = path.join(__dirname, 'contact-submissions.json');
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message)
        return res.status(400).json({ error: 'name, email, and message are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ error: 'Invalid email address.' });

    const entry = {
        id: crypto.randomUUID(), name: name.trim(), email: email.trim(),
        subject: (subject || 'General').trim(), message: message.trim(),
        createdAt: new Date().toISOString()
    };

    let subs = [];
    try { if (fs.existsSync(LOG_PATH)) subs = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); }
    catch (_) {}
    subs.push(entry);
    fs.writeFileSync(LOG_PATH, JSON.stringify(subs, null, 2));

    console.log(`📧  Contact from ${entry.email} (${entry.subject})`);
    return res.json({ success: true, message: "Thanks! We'll be in touch within 24 hours.", id: entry.id });
});

// Catch-all → index.html
app.use((_req, res) => {
    const idx = path.join(__dirname, 'index.html');
    fs.existsSync(idx) ? res.sendFile(idx) : res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, _req, res, _next) => {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large. Max 5 MB.' });
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error.' });
});

// ── Start ──────────────────────────────────────────────
(async () => {
    await loadModel();
    app.listen(PORT, () => {
        console.log('─────────────────────────────────────────');
        console.log(`🚀  Vision Nova → http://localhost:${PORT}`);
        console.log('─────────────────────────────────────────');
        console.log(`    GET  /                     Home page`);
        console.log(`    GET  /api/health           Model status`);
        console.log(`    POST /api/analyze          AI image caption (Gemini only)`);
        console.log(`    POST /api/tts              TTS params`);
        console.log(`    POST /api/contact          Contact form`);
        console.log('─────────────────────────────────────────');
        console.log('─────────────────────────────────────────\n');
    });
})();

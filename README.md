# Vision Nova — AI Visual Accessibility Platform

A full-stack web app that uses **on-device AI** (no cloud API key needed) to generate
accessible alt-text descriptions for images, plus a live Text-to-Speech demo.

---

## 📁 Project Structure

```
vision-nova/
├── index.html              ← Home page (hero + TTS demo + image AI)
├── resources.html          ← Resources / guides page
├── contact.html            ← Contact form page
├── styles.css              ← All styles
├── script.js               ← All frontend logic (API calls, TTS, forms)
├── server.js               ← Node.js backend (Express + AI)
├── package.json
└── README.md
```

---

## 🚀 How to Run

### Prerequisites
- **Node.js v18 or later** — [Download here](https://nodejs.org)
- ~2 GB free disk space (for the AI model weights downloaded on first run)
- Internet connection on **first run only** (to download the model)

---

### Step 1 — Extract the ZIP

Unzip `vision-nova.zip` somewhere on your computer, then open that folder in VS Code.

```
File → Open Folder → select the vision-nova folder
```

---

### Step 2 — Open the Integrated Terminal

In VS Code:  **Terminal → New Terminal**  (or press `` Ctrl+` ``)

---

### Step 3 — Install Dependencies

```bash
npm install
```

This installs Express, Multer, and the @xenova/transformers AI library (~50 MB of JS code).

---

### Step 4 — Start the Server

```bash
npm start
```

**First run only:** the server will automatically download the AI model weights (~900 MB).
You'll see a progress log in the terminal. This takes 1–3 minutes on a typical connection.

Once you see:
```
✅  AI model ready!
🚀  Vision Nova → http://localhost:3000
```

The app is live!

---

### Step 5 — Open in Browser

Navigate to:  **http://localhost:3000**

---

## 🧠 How the AI Works

- **Model:** `Xenova/vit-gpt2-image-captioning` (ViT + GPT-2)
- **Library:** `@xenova/transformers` — runs 100% in Node.js, no GPU needed
- **Privacy:** Images are processed **locally on your machine** and deleted immediately
- **Speed:** ~2–8 seconds per image on a modern laptop CPU

---

## 📡 API Endpoints

| Method | Endpoint              | Description                        |
|--------|-----------------------|------------------------------------|
| GET    | `/api/health`         | Model status & uptime              |
| POST   | `/api/analyze`        | Upload image → get AI description  |
| POST   | `/api/tts`            | TTS parameters (browser speaks)    |
| POST   | `/api/contact`        | Submit contact form                |

---

## 🛑 Stopping the Server

Press **Ctrl + C** in the terminal.

---

## 🔧 Tips

- **Hot reload during development:** use `npm run dev` (uses Node's built-in `--watch`)
- **Contact submissions** are saved to `contact-submissions.json` in the project root
- **Model cache** lives in `.model-cache/` — delete it to force a re-download
- **Port conflict?** Set a different port: `PORT=4000 npm start`

## ☁️ Gemini API Integration (optional)

If you want to use Google Gemini to generate descriptive text from an image and then read it aloud:

1. Set your Gemini key in environment variable (Windows PowerShell):
	```powershell
	$env:GEMINI_API_KEY = 'your-key-here'
	npm start
	```
2. On macOS/Linux:
	```bash
	export GEMINI_API_KEY='your-key-here'
	npm start
	```
3. If `GEMINI_API_KEY` is set, `/api/analyze` will:
	- run OCR first via Tesseract
	- if OCR output is short, call Gemini to extract/describe text
	- fallback to local Xenova captioning if needed

4. Runtime image input options now include:
	- file upload
	- drag and drop
	- clipboard paste (Ctrl+V or Paste Image button)
	- camera capture (Open Camera button)

5. `/api/analyze` now returns:
	- `exactText` (raw text extracted from image)
	- `summary` (short AI summary for speech)
	- `confidence`, `source`

6. The frontend auto-reads the returned `summary` aloud using browser speech synthesis.

---

## 🌐 Upgrading to Google Cloud TTS (optional)

The server has commented-out code for Google Cloud Text-to-Speech.
To enable it:
1. Create a GCP project and enable the TTS API
2. Download your service account JSON key
3. `npm install @google-cloud/text-to-speech`
4. Uncomment the GCP block in `server.js` → `/api/tts`

---

_Vision Nova © 2025_

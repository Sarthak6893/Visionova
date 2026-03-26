/**
 * Vision Nova — Frontend Script
 * ──────────────────────────────────────────────────────
 * Handles:
 *   • Mobile menu
 *   • Scroll reveal animations
 *   • Stats counter
 *   • Text-to-Speech demo (browser Web Speech API)
 *   • AI image upload & analysis  →  POST /api/analyze
 *   • Contact form                →  POST /api/contact
 *   • Resource filter tabs
 * ──────────────────────────────────────────────────────
 */

'use strict';

// ── State ──────────────────────────────────────────────
let mobileMenuOpen = false;
let isSpeaking     = false;

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initStatsCounter();
    initTTSDemo();
    initImageAnalysis();
    initContactForm();
    initResourceFilter();
});

// ══════════════════════════════════════════════════════
//  MOBILE MENU
// ══════════════════════════════════════════════════════
function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
    const menu    = document.querySelector('.mobile-menu');
    const overlay = document.querySelector('.mobile-overlay');
    if (menu)    menu.classList.toggle('open',    mobileMenuOpen);
    if (overlay) overlay.classList.toggle('open', mobileMenuOpen);
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenuOpen) toggleMobileMenu();
});

// ══════════════════════════════════════════════════════
//  SCROLL REVEAL
// ══════════════════════════════════════════════════════
function initScrollReveal() {
    const reveals  = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(el => observer.observe(el));
}

// ══════════════════════════════════════════════════════
//  STATS COUNTER
// ══════════════════════════════════════════════════════
function initStatsCounter() {
    const stats    = document.querySelectorAll('.stat-number');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el     = entry.target;
                const target = parseFloat(el.innerText);
                animateCounter(el, target);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.5 });
    stats.forEach(el => observer.observe(el));
}

function animateCounter(el, target) {
    const duration  = 2000;
    const startTime = performance.now();
    const isDecimal = target % 1 !== 0;
    (function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease     = 1 - Math.pow(1 - progress, 3);
        const current  = target * ease;
        el.textContent = isDecimal ? current.toFixed(1) : Math.round(current);
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = isDecimal ? target.toFixed(1) + 'M+' : target + '+';
        }
    })(startTime);
}

// ══════════════════════════════════════════════════════
//  SCROLL-TO-DEMO
// ══════════════════════════════════════════════════════
function scrollToDemo() {
    const section = document.getElementById('demo-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
}

// ══════════════════════════════════════════════════════
//  TEXT-TO-SPEECH DEMO
// ══════════════════════════════════════════════════════
function initTTSDemo() {
    const speakBtn   = document.getElementById('speak-btn');
    const stopBtn    = document.getElementById('stop-btn');
    const speedRange = document.getElementById('speed-range');

    if (!speakBtn) return;

    populateVoices();
    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = populateVoices;
    }

    speedRange && speedRange.addEventListener('input', updateSpeedLabel);
    updateSpeedLabel();

    speakBtn.addEventListener('click', () => {
        const text = document.getElementById('tts-input')?.value?.trim();
        if (!text) { setTTSStatus('Please enter some text first.', 'warning'); return; }
        if (text.length > 500) { setTTSStatus('Text must be 500 characters or less.', 'warning'); return; }
        speakText(text);
    });

    stopBtn && stopBtn.addEventListener('click', stopSpeaking);
}

function populateVoices() {
    const select = document.getElementById('voice-select');
    if (!select || !window.speechSynthesis) return;
    const voices    = window.speechSynthesis.getVoices();
    const engVoices = voices.filter(v => v.lang.startsWith('en'));
    select.innerHTML = '<option value="default">Default Voice</option>';
    engVoices.forEach(voice => {
        const opt       = document.createElement('option');
        opt.value       = voice.name;
        opt.textContent = `${voice.name} (${voice.lang})`;
        select.appendChild(opt);
    });
}

function updateSpeedLabel() {
    const range = document.getElementById('speed-range');
    const label = document.getElementById('speed-value');
    if (range && label) label.textContent = parseFloat(range.value).toFixed(1) + 'x';
}

function speakText(text) {
    if (!('speechSynthesis' in window)) {
        setTTSStatus('Your browser does not support text-to-speech.', 'error');
        return;
    }
    window.speechSynthesis.cancel();
    isSpeaking = true;

    const speakBtn   = document.getElementById('speak-btn');
    const voiceSel   = document.getElementById('voice-select');
    const speedRange = document.getElementById('speed-range');
    const utterance  = new SpeechSynthesisUtterance(text);

    utterance.rate   = parseFloat(speedRange?.value || '1.0');
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;

    if (voiceSel?.value && voiceSel.value !== 'default') {
        const found = window.speechSynthesis.getVoices().find(v => v.name === voiceSel.value);
        if (found) utterance.voice = found;
    }

    utterance.onstart = () => {
        speakBtn?.classList.add('playing');
        setTTSStatus('Speaking…', 'success');
    };
    utterance.onend = utterance.onerror = () => {
        isSpeaking = false;
        speakBtn?.classList.remove('playing');
        setTTSStatus('');
    };

    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isSpeaking = false;
    document.getElementById('speak-btn')?.classList.remove('playing');
    setTTSStatus('');
}

function setTTSStatus(msg, type) {
    const el = document.getElementById('tts-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'error'   ? 'var(--error)'
                   : type === 'warning' ? 'var(--warning)'
                   : type === 'success' ? 'var(--accent)'
                   : 'var(--muted)';
}

// ══════════════════════════════════════════════════════
//  AI IMAGE ANALYSIS
// ══════════════════════════════════════════════════════
function initImageAnalysis() {

    const uploadZone = document.getElementById('upload-zone');
    const fileInput  = document.getElementById('image-upload');
    const captureInput = document.getElementById('image-capture');
    const analyzeBtn = document.getElementById('analyze-btn');
    const pasteBtn   = document.getElementById('paste-image-btn');
    const captureBtn = document.getElementById('capture-image-btn');
    const copySummaryBtn = document.getElementById('copy-summary-btn');
    const copyExactBtn   = document.getElementById('copy-exact-btn');
    const speakSummaryBtn = document.getElementById('speak-summary-btn');
    // Camera modal elements
    const cameraModal = document.getElementById('camera-modal');
    const cameraVideo = document.getElementById('camera-video');
    const capturePhotoBtn = document.getElementById('capture-photo-btn');
    const closeCameraBtn = document.getElementById('close-camera-btn');
    let cameraStream = null;

    if (!fileInput) return;

    // Drag-and-drop
    uploadZone && uploadZone.addEventListener('dragover', e => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone && uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    uploadZone && uploadZone.addEventListener('drop', e => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            handleFilePreview(file);
        }
    });

    // File picker
    fileInput.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (file) handleFilePreview(file);
    });


    // Camera capture (getUserMedia for all browsers)
    captureBtn && captureBtn.addEventListener('click', async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Camera access is not supported in this browser.');
            return;
        }
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            cameraVideo.srcObject = cameraStream;
            cameraModal.classList.remove('hidden');
        } catch (err) {
            alert('Unable to access camera: ' + err.message);
        }
    });

    closeCameraBtn && closeCameraBtn.addEventListener('click', () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        cameraModal.classList.add('hidden');
        cameraVideo.srcObject = null;
    });

    capturePhotoBtn && capturePhotoBtn.addEventListener('click', () => {
        if (!cameraStream) return;
        const canvas = document.createElement('canvas');
        canvas.width = cameraVideo.videoWidth;
        canvas.height = cameraVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
            if (blob) {
                const file = new File([blob], `camera-${Date.now()}.png`, { type: 'image/png' });
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                handleFilePreview(file);
            }
        }, 'image/png');
        // Close camera after capture
        closeCameraBtn.click();
    });

    // Clipboard image paste via button
    pasteBtn && pasteBtn.addEventListener('click', async () => {
        if (!navigator.clipboard || !navigator.clipboard.read) {
            alert('Clipboard image paste is not supported in this browser. Use Ctrl+V in the upload area.');
            return;
        }

        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (!imageType) continue;
                const blob = await item.getType(imageType);
                const file = new File([blob], `clipboard-${Date.now()}.png`, { type: imageType });
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                handleFilePreview(file);
                return;
            }
            alert('No image found in clipboard. Copy an image first, then try again.');
        } catch (_err) {
            alert('Clipboard access failed. You can still drag/drop or upload manually.');
        }
    });

    // Global paste support for runtime image input (Ctrl+V)
    document.addEventListener('paste', e => {
        const pastedImage = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
        if (!pastedImage) return;
        const blob = pastedImage.getAsFile();
        if (!blob) return;
        const file = new File([blob], `pasted-${Date.now()}.png`, { type: blob.type });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        handleFilePreview(file);
    });

    // Analyze button
    analyzeBtn && analyzeBtn.addEventListener('click', () => {
        const file = fileInput.files?.[0];
        if (file) analyzeImage(file);
    });

    // Copy summary
    copySummaryBtn && copySummaryBtn.addEventListener('click', () => {
        const summary = document.getElementById('generated-summary')?.textContent?.trim();
        if (!summary) return;
        navigator.clipboard.writeText(summary).then(() => {
            copySummaryBtn.textContent = 'Copied!';
            setTimeout(() => (copySummaryBtn.textContent = 'Copy Summary'), 1800);
        }).catch(() => {
            copySummaryBtn.textContent = 'Copy failed';
            setTimeout(() => (copySummaryBtn.textContent = 'Copy Summary'), 1800);
        });
    });

    // Copy exact text
    copyExactBtn && copyExactBtn.addEventListener('click', () => {
        const exactText = document.getElementById('generated-exact-text')?.textContent?.trim();
        if (!exactText) return;
        navigator.clipboard.writeText(exactText).then(() => {
            copyExactBtn.textContent = 'Copied!';
            setTimeout(() => (copyExactBtn.textContent = 'Copy Exact Text'), 1800);
        }).catch(() => {
            copyExactBtn.textContent = 'Copy failed';
            setTimeout(() => (copyExactBtn.textContent = 'Copy Exact Text'), 1800);
        });
    });

    // Manual summary speech
    speakSummaryBtn && speakSummaryBtn.addEventListener('click', () => {
        const summary = document.getElementById('generated-summary')?.textContent?.trim();
        if (summary) speakDescriptionLocally(summary);
    });
}

function handleFilePreview(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image file (PNG, JPG, GIF, WebP).');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('File is too large. Max size is 5 MB.');
        return;
    }

    const preview     = document.getElementById('image-preview');
    const placeholder = document.getElementById('upload-placeholder');
    const analyzeBtn  = document.getElementById('analyze-btn');
    const reader      = new FileReader();

    reader.onload = e => {
        if (preview)    { preview.src = e.target.result; preview.classList.remove('hidden'); }
        if (placeholder)  placeholder.classList.add('hidden');
        if (analyzeBtn)   analyzeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
    showResultArea('placeholder');
}

async function analyzeImage(file) {
    const analyzeBtn    = document.getElementById('analyze-btn');
    const summaryEl     = document.getElementById('generated-summary');
    const exactTextEl   = document.getElementById('generated-exact-text');
    const confidenceEl  = document.getElementById('confidence-score');

    analyzeBtn.disabled    = true;
    analyzeBtn.textContent = 'Analyzing…';
    showResultArea('loading');

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res  = await fetch('/api/analyze', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed.');

        const summary = (data.summary || data.description || '').trim();
        const exactText = (data.exactText || '').trim();

        if (summaryEl) summaryEl.textContent = summary || 'No summary generated.';
        if (exactTextEl) exactTextEl.textContent = exactText || 'No exact text detected.';
        if (confidenceEl)  confidenceEl.textContent  = data.confidence || 'On-Device AI';

        showResultArea('result');
        if (summary) speakDescriptionLocally(summary);

    } catch (err) {
        console.error('Image analysis error:', err);
        showResultArea('error', 'An error occurred. Please try again.');
    } finally {
        analyzeBtn.disabled    = false;
        analyzeBtn.textContent = 'Analyze Image';
    }
}

function showResultArea(state, message) {
    const loader      = document.getElementById('img-loader');
    const placeholder = document.getElementById('result-placeholder');
    const resultArea  = document.getElementById('result-content');
    [loader, placeholder, resultArea].forEach(el => el && el.classList.add('hidden'));

    if (state === 'loading'   && loader)      loader.classList.remove('hidden');
    if (state === 'result'    && resultArea)  resultArea.classList.remove('hidden');
    if ((state === 'placeholder' || state === 'error') && placeholder) {
        placeholder.classList.remove('hidden');
        const p = placeholder.querySelector('p');
        if (p) p.textContent = message || 'Analysis results will appear here';
    }
}

function speakDescriptionLocally(text) {
    if (!text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

// ══════════════════════════════════════════════════════
//  CONTACT FORM
// ══════════════════════════════════════════════════════
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const status = document.getElementById('contact-status');
        const btn    = form.querySelector('button[type="submit"]');

        const payload = {
            name:    document.getElementById('contact-name')?.value?.trim(),
            email:   document.getElementById('contact-email')?.value?.trim(),
            subject: document.getElementById('contact-subject')?.value,
            message: document.getElementById('contact-message')?.value?.trim()
        };

        if (!payload.name || !payload.email || !payload.message) {
            setFormStatus(status, 'Please fill in all required fields.', 'error');
            return;
        }

        btn.disabled    = true;
        btn.textContent = 'Sending…';
        setFormStatus(status, '');

        try {
            const res  = await fetch('/api/contact', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Submission failed.');
            setFormStatus(status, data.message || 'Message sent!', 'success');
            form.reset();
        } catch (err) {
            setFormStatus(status, err.message, 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Send Message';
        }
    });
}

// ══════════════════════════════════════════════════════
//  RESOURCE FILTER TABS
// ══════════════════════════════════════════════════════
function initResourceFilter() {
    const tabs  = document.querySelectorAll('.resource-tab');
    const cards = document.querySelectorAll('.resource-card');
    if (!tabs.length) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.classList.add('text-[var(--muted)]');
            });
            tab.classList.add('active');
            tab.classList.remove('text-[var(--muted)]');

            const filter = tab.dataset.filter;
            cards.forEach(card => {
                card.style.display = (filter === 'all' || card.dataset.category === filter) ? '' : 'none';
            });
        });
    });
}

// ══════════════════════════════════════════════════════
//  HELPER — inline status messages
// ══════════════════════════════════════════════════════
function setFormStatus(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.style.color = type === 'error'   ? 'var(--error)'
                   : type === 'warning' ? 'var(--warning)'
                   : type === 'success' ? 'var(--accent)'
                   : 'var(--muted)';
}

(() => {
if (window.__realPlayProfileIntroInstalled) return;
window.__realPlayProfileIntroInstalled = true;
const API_BASE_URL = 'https://api.clarapmc.com';
const TOKEN_KEY = 'real_play_access_token';
const DB_NAME = 'real_play_profile_media_v1';
const DB_VERSION = 1;
const STORE_NAME = 'player_intro';
const RECORD_MS = 5000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_DURATION_SECONDS = 8.5;
const MIN_DURATION_SECONDS = 1.5;
let profileState = null;
let stableKey = 'player';
let activeBlob = null;
let activeObjectUrl = '';
let editor = null;
let fileInput = null;
let candidateBlob = null;
let candidateUrl = '';
let liveStream = null;
let recorder = null;
let recordTimer = null;
let countdownTimer = null;
let introObserver = null;
let introVisible = false;
let loadingIdentity = false;
function token() {
return localStorage.getItem(TOKEN_KEY) || '';
}
function safeKey(value) {
return String(value || 'player')
.trim()
.toLowerCase()
.replace(/[^a-z0-9@._-]+/g, '-')
.slice(0, 160) || 'player';
}
function playerInitials() {
const name = String(
profileState?.profile?.player_name ||
profileState?.profile?.playerName ||
profileState?.profile?.name ||
document.querySelector('.rp-profile-name h1')?.textContent ||
'RP'
).trim();
const parts = name.split(/\s+/).filter(Boolean);
return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}
function openDatabase() {
return new Promise((resolve, reject) => {
if (!('indexedDB' in window)) {
reject(new Error('This device cannot save a player intro locally.'));
return;
}
const request = indexedDB.open(DB_NAME, DB_VERSION);
request.onupgradeneeded = () => {
const db = request.result;
if (!db.objectStoreNames.contains(STORE_NAME)) {
db.createObjectStore(STORE_NAME, { keyPath: 'key' });
}
};
request.onsuccess = () => resolve(request.result);
request.onerror = () => reject(request.error || new Error('Could not open player intro storage.'));
});
}
async function readStoredIntro(key) {
const db = await openDatabase();
try {
return await new Promise((resolve, reject) => {
const tx = db.transaction(STORE_NAME, 'readonly');
const request = tx.objectStore(STORE_NAME).get(key);
request.onsuccess = () => resolve(request.result || null);
request.onerror = () => reject(request.error || new Error('Could not read player intro.'));
});
} finally {
db.close();
}
}
async function writeStoredIntro(key, blob) {
const db = await openDatabase();
try {
await new Promise((resolve, reject) => {
const tx = db.transaction(STORE_NAME, 'readwrite');
tx.objectStore(STORE_NAME).put({
key,
blob,
mimeType: blob.type || 'video/webm',
updatedAt: new Date().toISOString(),
});
tx.oncomplete = () => resolve();
tx.onerror = () => reject(tx.error || new Error('Could not save player intro.'));
tx.onabort = () => reject(tx.error || new Error('Could not save player intro.'));
});
} finally {
db.close();
}
}
async function removeStoredIntro(key) {
const db = await openDatabase();
try {
await new Promise((resolve, reject) => {
const tx = db.transaction(STORE_NAME, 'readwrite');
tx.objectStore(STORE_NAME).delete(key);
tx.oncomplete = () => resolve();
tx.onerror = () => reject(tx.error || new Error('Could not remove player intro.'));
});
} finally {
db.close();
}
}
function releaseActiveUrl() {
if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
activeObjectUrl = '';
}
function setActiveBlob(blob) {
releaseActiveUrl();
activeBlob = blob || null;
if (activeBlob) activeObjectUrl = URL.createObjectURL(activeBlob);
}
async function loadIdentity() {
if (loadingIdentity) return;
const accessToken = token();
if (!accessToken) return;
loadingIdentity = true;
try {
const response = await fetch(`${API_BASE_URL}/api/real-play/me`, {
headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
cache: 'no-store',
});
if (!response.ok) return;
profileState = await response.json().catch(() => ({}));
const profile = profileState?.profile || {};
stableKey = safeKey(
profile.user_id || profile.userId || profile.id || profile.email ||
`${profile.player_name || profile.playerName || profile.name || 'player'}-${profileState?.currentNumber?.number ?? ''}`
);
const record = await readStoredIntro(stableKey).catch(() => null);
setActiveBlob(record?.blob instanceof Blob ? record.blob : null);
mountIntro();
} catch (_error) {
// The profile remains fully usable when local media cannot be loaded.
} finally {
loadingIdentity = false;
}
}
function ensureFileInput() {
if (fileInput) return fileInput;
fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'video/mp4,video/webm,video/quicktime,video/*';
fileInput.className = 'rp-profile-intro-input';
fileInput.setAttribute('aria-label', 'Choose short player intro video');
fileInput.addEventListener('change', handleChosenVideo);
document.body.appendChild(fileInput);
return fileInput;
}
function introMarkup() {
if (activeBlob && activeObjectUrl) {
return `
<video data-rp-player-intro-video muted loop playsinline preload="metadata" aria-label="Player intro loop"></video>
<span class="rp-profile-intro-shade" aria-hidden="true"></span>
<span class="rp-profile-intro-label" aria-hidden="true"><i></i> PROFILE LOOP</span>
<span class="rp-profile-intro-edit" aria-hidden="true">✎</span>`;
}
return `
<span class="rp-profile-intro-placeholder" aria-hidden="true">
<b>${playerInitials()}</b>
<i>▶</i>
<small>ADD INTRO</small>
</span>`;
}
function mountManageButton() {
const actions = document.querySelector('[data-rp-profile] .rp-profile-actions');
if (!actions || actions.querySelector('[data-rp-profile-manage-intro]')) return;
const button = document.createElement('button');
button.type = 'button';
button.dataset.rpProfileManageIntro = 'true';
button.className = 'rp-profile-manage-intro';
button.innerHTML = '<span>▣</span> MANAGE PLAYER INTRO';
button.addEventListener('click', openEditor);
actions.prepend(button);
}
function mountIntro() {
const panel = document.querySelector('[data-rp-profile]');
const player = panel?.querySelector('.rp-profile-player');
if (!panel || !player) return;
player.querySelector('[data-rp-player-photo]')?.remove();
player.classList.remove('rp-profile-player-with-photo');
player.classList.add('rp-profile-player-with-intro');
let button = player.querySelector('[data-rp-player-intro]');
if (!button) {
button = document.createElement('button');
button.type = 'button';
button.className = 'rp-profile-intro';
button.dataset.rpPlayerIntro = 'true';
button.addEventListener('click', openEditor);
player.appendChild(button);
}
const introState = activeBlob ? 'video' : 'empty';
button.classList.toggle('has-intro', Boolean(activeBlob));
if (button.dataset.rpIntroState !== introState) {
button.dataset.rpIntroState = introState;
button.setAttribute('aria-label', activeBlob ? 'Change player intro video' : 'Add player intro video');
button.innerHTML = introMarkup();
}
const video = button.querySelector('[data-rp-player-intro-video]');
if (video && activeObjectUrl && video.src !== activeObjectUrl) {
video.src = activeObjectUrl;
video.addEventListener('canplay', syncPlayback, { once: true });
}
observeIntro(button);
mountManageButton();
syncPlayback();
}
function observeIntro(node) {
introObserver?.disconnect();
introVisible = false;
if (!('IntersectionObserver' in window)) {
introVisible = true;
return;
}
introObserver = new IntersectionObserver((entries) => {
introVisible = Boolean(entries[0]?.isIntersecting && entries[0]?.intersectionRatio > 0.25);
syncPlayback();
}, { threshold: [0, 0.25, 0.6] });
introObserver.observe(node);
}
function syncPlayback() {
const panel = document.querySelector('[data-rp-profile]');
const video = panel?.querySelector('[data-rp-player-intro-video]');
if (!video) return;
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
const shouldPlay = panel.classList.contains('open') && introVisible && !document.hidden && !reduceMotion;
if (shouldPlay) video.play().catch(() => {});
else video.pause();
}
function createEditor() {
if (editor) return editor;
editor = document.createElement('div');
editor.className = 'rp-profile-intro-editor';
editor.hidden = true;
editor.innerHTML = `
<section class="rp-profile-intro-card" role="dialog" aria-modal="true" aria-labelledby="rp-intro-title">
<header>
<div><small>PLAYER IDENTITY</small><h2 id="rp-intro-title">YOUR PLAYER INTRO.</h2></div>
<button type="button" data-rp-intro-close aria-label="Close player intro editor">×</button>
</header>
<div class="rp-profile-intro-stage" data-rp-intro-stage>
<video data-rp-intro-preview muted playsinline></video>
<div class="rp-profile-intro-stage-empty" data-rp-intro-empty>
<b>${playerInitials()}</b>
<span>HEAD · SHOULDERS · CHEST</span>
</div>
<span class="rp-profile-intro-guide" aria-hidden="true"></span>
<span class="rp-profile-intro-recording" data-rp-intro-recording hidden><i></i> RECORDING · <b>5</b></span>
</div>
<p class="rp-profile-intro-help">Keep your head, shoulders and upper body inside the frame. The intro plays muted and loops on your profile.</p>
<p class="rp-profile-intro-status" data-rp-intro-status aria-live="polite"></p>
<div class="rp-profile-intro-actions">
<button type="button" class="secondary" data-rp-intro-choose>CHOOSE VIDEO</button>
<button type="button" class="primary" data-rp-intro-record>RECORD 5 SEC</button>
<button type="button" class="secondary" data-rp-intro-retake hidden>RETAKE</button>
<button type="button" class="primary" data-rp-intro-save hidden>USE THIS</button>
</div>
<button type="button" class="rp-profile-intro-remove" data-rp-intro-remove hidden>REMOVE PLAYER INTRO</button>
</section>`;
document.body.appendChild(editor);
editor.querySelector('[data-rp-intro-close]')?.addEventListener('click', closeEditor);
editor.addEventListener('click', (event) => { if (event.target === editor) closeEditor(); });
editor.querySelector('[data-rp-intro-record]')?.addEventListener('click', startRecording);
editor.querySelector('[data-rp-intro-choose]')?.addEventListener('click', () => ensureFileInput().click());
editor.querySelector('[data-rp-intro-retake]')?.addEventListener('click', resetCandidate);
editor.querySelector('[data-rp-intro-save]')?.addEventListener('click', saveCandidate);
editor.querySelector('[data-rp-intro-remove]')?.addEventListener('click', removeIntro);
return editor;
}
function setEditorStatus(message = '', error = false) {
const node = editor?.querySelector('[data-rp-intro-status]');
if (!node) return;
node.textContent = message;
node.classList.toggle('error', error);
}
function setProfileStatus(message = '', error = false) {
const node = document.querySelector('[data-rp-profile-status]');
if (!node) return;
node.textContent = message;
node.classList.toggle('error', error);
node.classList.toggle('success', Boolean(message) && !error);
if (message && !error) {
setTimeout(() => {
if (node.textContent === message) {
node.textContent = '';
node.classList.remove('success');
}
}, 2000);
}
}
function releaseCandidateUrl() {
if (candidateUrl) URL.revokeObjectURL(candidateUrl);
candidateUrl = '';
}
function stopLiveStream() {
liveStream?.getTracks?.().forEach((track) => track.stop());
liveStream = null;
if (recordTimer) clearTimeout(recordTimer);
if (countdownTimer) clearInterval(countdownTimer);
recordTimer = null;
countdownTimer = null;
}
function stopRecorderIfNeeded() {
try {
if (recorder && recorder.state !== 'inactive') recorder.stop();
} catch (_error) {}
recorder = null;
stopLiveStream();
}
function previewBlob(blob, { candidate = false } = {}) {
const stage = editor?.querySelector('[data-rp-intro-stage]');
const preview = editor?.querySelector('[data-rp-intro-preview]');
const empty = editor?.querySelector('[data-rp-intro-empty]');
if (!preview || !empty || !blob) return;
stage?.classList.remove('is-live');
if (candidate) {
releaseCandidateUrl();
candidateUrl = URL.createObjectURL(blob);
preview.src = candidateUrl;
} else if (activeObjectUrl) {
preview.src = activeObjectUrl;
}
preview.srcObject = null;
preview.loop = true;
preview.controls = false;
preview.muted = true;
empty.hidden = true;
preview.play().catch(() => {});
}
function updateEditorActions(hasCandidate = false) {
editor?.querySelector('[data-rp-intro-record]')?.toggleAttribute('hidden', hasCandidate);
editor?.querySelector('[data-rp-intro-choose]')?.toggleAttribute('hidden', hasCandidate);
editor?.querySelector('[data-rp-intro-retake]')?.toggleAttribute('hidden', !hasCandidate);
editor?.querySelector('[data-rp-intro-save]')?.toggleAttribute('hidden', !hasCandidate);
editor?.querySelector('[data-rp-intro-remove]')?.toggleAttribute('hidden', !activeBlob || hasCandidate);
}
function openEditor() {
createEditor();
candidateBlob = null;
releaseCandidateUrl();
stopRecorderIfNeeded();
setEditorStatus('');
editor.hidden = false;
document.body.classList.add('rp-profile-intro-editing');
updateEditorActions(false);
const stage = editor.querySelector('[data-rp-intro-stage]');
const preview = editor.querySelector('[data-rp-intro-preview]');
const empty = editor.querySelector('[data-rp-intro-empty]');
stage?.classList.remove('is-live');
preview.pause();
preview.srcObject = null;
preview.removeAttribute('src');
preview.load();
empty.hidden = false;
if (activeBlob && activeObjectUrl) previewBlob(activeBlob);
}
function closeEditor() {
if (!editor) return;
stopRecorderIfNeeded();
candidateBlob = null;
releaseCandidateUrl();
editor.querySelector('[data-rp-intro-stage]')?.classList.remove('is-live');
const preview = editor.querySelector('[data-rp-intro-preview]');
if (preview) {
preview.pause();
preview.srcObject = null;
preview.removeAttribute('src');
preview.load();
}
editor.hidden = true;
document.body.classList.remove('rp-profile-intro-editing');
syncPlayback();
}
function pickRecorderMimeType() {
const options = [
'video/mp4;codecs=h264',
'video/webm;codecs=vp9',
'video/webm;codecs=vp8',
'video/webm',
'video/mp4',
];
return options.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}
async function startRecording() {
if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
setEditorStatus('Direct recording is not supported on this browser. Choose a short video instead.', true);
ensureFileInput().click();
return;
}
stopRecorderIfNeeded();
candidateBlob = null;
releaseCandidateUrl();
setEditorStatus('Opening camera…');
try {
liveStream = await navigator.mediaDevices.getUserMedia({
audio: false,
video: {
facingMode: 'user',
width: { ideal: 720 },
height: { ideal: 900 },
aspectRatio: { ideal: 0.8 },
},
});
const stage = editor.querySelector('[data-rp-intro-stage]');
const preview = editor.querySelector('[data-rp-intro-preview]');
const empty = editor.querySelector('[data-rp-intro-empty]');
stage?.classList.add('is-live');
preview.srcObject = liveStream;
preview.removeAttribute('src');
preview.loop = false;
preview.muted = true;
empty.hidden = true;
await preview.play().catch(() => {});
const mimeType = pickRecorderMimeType();
const chunks = [];
recorder = mimeType ? new MediaRecorder(liveStream, { mimeType }) : new MediaRecorder(liveStream);
recorder.addEventListener('dataavailable', (event) => {
if (event.data?.size) chunks.push(event.data);
});
recorder.addEventListener('stop', () => {
const type = recorder?.mimeType || mimeType || chunks[0]?.type || 'video/webm';
const blob = new Blob(chunks, { type });
recorder = null;
stopLiveStream();
editor.querySelector('[data-rp-intro-recording]')?.setAttribute('hidden', '');
if (!blob.size) {
setEditorStatus('The recording could not be saved. Try again.', true);
resetCandidate();
return;
}
candidateBlob = blob;
previewBlob(candidateBlob, { candidate: true });
updateEditorActions(true);
setEditorStatus('Preview your loop. Use it or retake it.');
}, { once: true });
recorder.start(250);
const recording = editor.querySelector('[data-rp-intro-recording]');
const count = recording?.querySelector('b');
recording?.removeAttribute('hidden');
let remaining = 5;
if (count) count.textContent = String(remaining);
setEditorStatus('Recording starts now. Keep your upper body inside the frame.');
countdownTimer = setInterval(() => {
remaining -= 1;
if (count) count.textContent = String(Math.max(0, remaining));
}, 1000);
recordTimer = setTimeout(() => {
try {
if (recorder?.state !== 'inactive') recorder.stop();
} catch (_error) {
stopLiveStream();
}
}, RECORD_MS);
} catch (error) {
stopLiveStream();
setEditorStatus(
error?.name === 'NotAllowedError'
? 'Camera permission was not allowed. You can choose a short video instead.'
: 'Could not open the camera. Choose a short video instead.',
true
);
}
}
function getVideoDuration(file) {
return new Promise((resolve, reject) => {
const url = URL.createObjectURL(file);
const video = document.createElement('video');
video.preload = 'metadata';
video.onloadedmetadata = () => {
const duration = Number(video.duration);
URL.revokeObjectURL(url);
resolve(duration);
};
video.onerror = () => {
URL.revokeObjectURL(url);
reject(new Error('Could not read video duration.'));
};
video.src = url;
});
}
async function handleChosenVideo(event) {
const file = event.target.files?.[0];
event.target.value = '';
if (!file) return;
openEditor();
if (!/^video\//i.test(file.type || '')) {
setEditorStatus('Choose a video file.', true);
return;
}
if (file.size > MAX_FILE_BYTES) {
setEditorStatus('That video is too large. Choose a clip under 25 MB.', true);
return;
}
try {
const duration = await getVideoDuration(file);
if (!Number.isFinite(duration) || duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS) {
setEditorStatus('Use a short clip around 3–6 seconds (maximum 8 seconds).', true);
return;
}
candidateBlob = file;
previewBlob(candidateBlob, { candidate: true });
updateEditorActions(true);
setEditorStatus('Preview your loop. Use it or choose another clip.');
} catch (_error) {
setEditorStatus('That video could not be opened. Try another clip.', true);
}
}
function resetCandidate() {
stopRecorderIfNeeded();
candidateBlob = null;
releaseCandidateUrl();
setEditorStatus('');
updateEditorActions(false);
const stage = editor?.querySelector('[data-rp-intro-stage]');
const preview = editor?.querySelector('[data-rp-intro-preview]');
const empty = editor?.querySelector('[data-rp-intro-empty]');
stage?.classList.remove('is-live');
if (!preview || !empty) return;
preview.pause();
preview.srcObject = null;
preview.removeAttribute('src');
preview.load();
empty.hidden = false;
if (activeBlob && activeObjectUrl) previewBlob(activeBlob);
}
async function saveCandidate() {
if (!candidateBlob) return;
const saveButton = editor?.querySelector('[data-rp-intro-save]');
if (saveButton) saveButton.disabled = true;
setEditorStatus('Saving player intro…');
try {
await writeStoredIntro(stableKey, candidateBlob);
setActiveBlob(candidateBlob);
mountIntro();
closeEditor();
setProfileStatus('PLAYER INTRO SAVED.');
window.dispatchEvent(new CustomEvent('realplay:profile-intro-changed', {
detail: { key: stableKey, hasIntro: true },
}));
} catch (_error) {
setEditorStatus('This device could not save the intro. Try a smaller clip.', true);
} finally {
if (saveButton) saveButton.disabled = false;
}
}
async function removeIntro() {
setEditorStatus('Removing player intro…');
try {
await removeStoredIntro(stableKey);
setActiveBlob(null);
mountIntro();
closeEditor();
setProfileStatus('PLAYER INTRO REMOVED.');
window.dispatchEvent(new CustomEvent('realplay:profile-intro-changed', {
detail: { key: stableKey, hasIntro: false },
}));
} catch (_error) {
setEditorStatus('Could not remove the intro on this device.', true);
}
}
function observeProfile() {
const observer = new MutationObserver(() => {
const panel = document.querySelector('[data-rp-profile]');
if (!panel) return;
mountIntro();
syncPlayback();
if (panel.classList.contains('open') && !profileState) loadIdentity();
});
observer.observe(document.documentElement, {
childList: true,
subtree: true,
attributes: true,
attributeFilter: ['class'],
});
}
document.addEventListener('click', (event) => {
if (!event.target.closest('[data-rp-main-action="profile"], [data-rp-open-profile]')) return;
setTimeout(() => {
profileState = null;
loadIdentity();
mountIntro();
}, 120);
}, true);
document.addEventListener('visibilitychange', syncPlayback);
window.addEventListener('keydown', (event) => {
if (event.key === 'Escape' && editor && !editor.hidden) {
event.preventDefault();
closeEditor();
}
});
window.addEventListener('beforeunload', () => {
releaseActiveUrl();
releaseCandidateUrl();
stopRecorderIfNeeded();
});
observeProfile();
ensureFileInput();
createEditor();
loadIdentity();
})();

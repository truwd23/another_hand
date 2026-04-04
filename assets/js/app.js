// ===============================================================
//  AMBIL ELEMEN HTML (video, canvas, tombol, checkbox, label)
// ===============================================================
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const gestureLabel = document.getElementById('gestureLabel');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnMute = document.getElementById('btnMute');
const singleModeEl = document.getElementById('singleMode');
const mirrorCheck = document.getElementById('mirrorVideo');
const textOutput = document.getElementById('textOutput');

// ===============================================================
//  VARIABEL GLOBAL
// ===============================================================
let lastGesture = null;
let muted = false;
let singleMode = true;
let running = false;
let stream = null;

// ===============================================================
//  MAPPING GESTURE → TEKS UNTUK DIBACAKAN
// ===============================================================
const gestureMap = {
  'Scoop Hand': 'Makan',
  'Pointing': 'kamu',
  'ThumbsUp': 'baik',
  'OK': 'setuju',
  'Fist': 'semangat',
  'Victory': 'sukses',
  'Rock': 'cinta',
  'Shaka': 'halo',
  'Peace': 'damai',
  'One Finger Bent-thumb': 'saya',
  'O-Shape': 'mau',
  'Triangle': 'rumah' // 🔹 Ditambahkan untuk gestur segitiga
};

// ===============================================================
//  FUNGSI TEXT-TO-SPEECH
// ===============================================================
function speak(text) {
  if (muted || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'id-ID';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ===============================================================
//  FUNGSI RULE-BASED UNTUK MENDETEKSI GESTURE 1 TANGAN
// ===============================================================
function detectGesture(landmarks) {
  const lm = landmarks;

  const tip = id => lm[id];
  const straight = (tipId, pipId) => lm[tipId].y < lm[pipId].y - 0.02;
  const curled = (tipId, pipId) => lm[tipId].y > lm[pipId].y - 0.02;

  const idxTip = tip(8);
  const midTip = tip(12);
  const ringTip = tip(16);
  const pinkTip = tip(20);
  const thumbTip = tip(4);

  const idxStr = straight(8,6);
  const midStr = straight(12,10);
  const ringStr = straight(16,14);
  const pinkStr = straight(20,18);

  const idxCurl = curled(8,6);
  const midCurl = curled(12,10);
  const ringCurl = curled(16,14);
  const pinkCurl = curled(20,18);

  // 🔹 GESTURE ASLI SATU TANGAN
  if (idxStr && midCurl && ringCurl && pinkCurl &&     
      curled(4,2) && lm[0].y > 0.45 && lm[0].y < 0.75)
      return 'Saya';

  if (Math.abs(thumbTip.x - idxTip.x) < 0.035 &&     
      midCurl && ringCurl && pinkCurl && lm[0].y > 0.45)
      return 'Mau';

  if (idxStr && midStr && ringCurl && pinkCurl &&
      Math.abs(idxTip.x - midTip.x) > 0.10)
      return 'Victory';

  if (idxStr && midStr && ringCurl && pinkCurl &&
      Math.abs(idxTip.x - midTip.x) <= 0.10)
      return 'Peace';

  if (pinkStr && straight(4,2) && idxCurl && midCurl && ringCurl)
      return 'Shaka';

  if (Math.abs(thumbTip.x - idxTip.x) < 0.05 && midStr && ringStr)
      return 'OK';

  if (idxStr && pinkStr && midCurl && ringCurl)
      return 'Rock';

  if (idxStr && midStr && ringStr && pinkStr)
      return 'Scoop Hand';

  if (straight(4,2) && idxCurl && midCurl && ringCurl && pinkCurl &&
      thumbTip.y < idxTip.y)
      return 'ThumbsUp';

  if (idxStr && midCurl && ringCurl && pinkCurl)
      return 'Pointing';

  if (idxCurl && midCurl && ringCurl && pinkCurl)
      return 'Fist';

  return null;
}

// ===============================================================
//  SETUP MEDIAPIPE HANDS
// ===============================================================
const hands = new Hands({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 0,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

hands.onResults(onResults);

// ===============================================================
//  FUNGSI onResults() (DIUBAH UNTUK DETEKSI DUA TANGAN)
// ===============================================================
async function onResults(results) {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (mirrorCheck.checked) {
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
  }

  canvasCtx.drawImage(results.image, 0, 0);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    
    // 1. Gambar skeleton untuk semua tangan yang terdeteksi terlebih dahulu
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      drawConnectors(canvasCtx, results.multiHandLandmarks[i], HAND_CONNECTIONS, {color: '#00FF88', lineWidth: 3});
      drawLandmarks(canvasCtx, results.multiHandLandmarks[i], {color: '#FF8C00', lineWidth: 2});
    }

    let isTriangle = false;

    // 2. CEK GESTURE DUA TANGAN (RUMAH / SEGITIGA)
    if (results.multiHandLandmarks.length === 2) {
      const hand1 = results.multiHandLandmarks[0];
      const hand2 = results.multiHandLandmarks[1];

      // Titik 8 = Ujung Telunjuk | Titik 4 = Ujung Jempol
      // Hitung jarak (distance) antara telunjuk kiri & kanan, serta jempol kiri & kanan
      const distIndex = Math.hypot(hand1[8].x - hand2[8].x, hand1[8].y - hand2[8].y);
      const distThumb = Math.hypot(hand1[4].x - hand2[4].x, hand1[4].y - hand2[4].y);

      // Jika jarak telunjuk dekat (< 0.08) DAN jarak jempol dekat (< 0.08), maka membentuk Segitiga
      if (distIndex < 0.08 && distThumb < 0.08) {
        isTriangle = true;
      }
    }

    // 3. TAMPILKAN HASILNYA
    if (isTriangle) {
      // 🔹 JIKA MEMBENTUK SEGITIGA ("RUMAH")
      const gestureName = 'Triangle';
      const mappedName = gestureMap[gestureName];

      gestureLabel.textContent = gestureName;
      textOutput.textContent = mappedName;

      if (!singleMode || gestureName !== lastGesture) {
        speak(mappedName);
        lastGesture = gestureName;
      }
    } else {
      // 🔹 JIKA BUKAN SEGITIGA, CEK GESTURE MASING-MASING TANGAN SEPERTI BIASA
      let detectedGestures = [];
      let translatedTexts = [];

      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const gesture = detectGesture(results.multiHandLandmarks[i]);
        if (gesture) {
          detectedGestures.push(gesture);
          translatedTexts.push(gestureMap[gesture] || gesture);
        }
      }

      if (detectedGestures.length > 0) {
        const combinedGesture = detectedGestures.join(' & ');
        const combinedMapped = translatedTexts.join(' '); 

        gestureLabel.textContent = combinedGesture;
        textOutput.textContent = combinedMapped;

        if (!singleMode || combinedGesture !== lastGesture) {
          speak(combinedMapped);
          lastGesture = combinedGesture;
        }
      } else {
        gestureLabel.textContent = '—';
        textOutput.textContent = 'Belum ada hasil';
        lastGesture = null;
      }
    }

  } else {
    gestureLabel.textContent = '—';
    textOutput.textContent = 'Belum ada hasil';
    lastGesture = null;
  }

  canvasCtx.restore();
}

// ===============================================================
//  FUNGSI START KAMERA
// ===============================================================
async function startCamera() {
  if (running) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    });

    videoElement.srcObject = stream;
    await videoElement.play();
    running = true;

    async function run() {
      if (!running) return;
      await hands.send({ image: videoElement });
      requestAnimationFrame(run);
    }
    run();

  } catch (err) {
    alert('Tidak bisa mengakses kamera. Periksa izin.');
  }
}

// ===============================================================
//  FUNGSI STOP KAMERA
// ===============================================================
function stopCamera() {
  running = false;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  videoElement.pause();
  videoElement.srcObject = null;

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  gestureLabel.textContent = '—';
  lastGesture = null;
}

// ===============================================================
//  EVENT LISTENER
// ===============================================================
btnStart.addEventListener('click', startCamera);
btnStop.addEventListener('click', stopCamera);

btnMute.addEventListener('click', () => {
  muted = !muted;
  btnMute.textContent = muted ? 'Unmute' : 'Mute';
});

singleModeEl.addEventListener('change', e => {
  singleMode = e.target.checked;
  document.getElementById('modeLabel').textContent =
    singleMode ? 'Single' : 'Repeat';
});

mirrorCheck.addEventListener('change', () => {
  document.getElementById('input_video').style.transform =
    mirrorCheck.checked ? 'scaleX(-1)' : 'scaleX(1)';
});
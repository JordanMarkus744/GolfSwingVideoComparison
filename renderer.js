const { ipcRenderer } = require("electron");

let timestamps = { video1: 0, video2: 0 };
let loopInterval = null;
let drawingMode = { video1: false, video2: false }; // Track drawing mode for each video
let isPaused = false;

// Select elements
const video1 = document.getElementById("video1");
const video2 = document.getElementById("video2");
let isVideo1 = false;
let isVideo2 = false;
const videoInput1 = document.getElementById("videoInput1");
const videoInput2 = document.getElementById("videoInput2");

// Create canvas overlays
const canvas1 = document.getElementById("canvas1");
const ctx1 = canvas1.getContext("2d");
const canvas2 = document.getElementById("canvas2");
const ctx2 = canvas2.getContext("2d");

// Resize canvases to match video
function resizeCanvas(canvas, video) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

// Load selected video into its player
function loadVideo(inputElement, videoElement, videoId, canvas) {
  const file = inputElement.files[0];
  if (file) {
    const videoURL = URL.createObjectURL(file);
    videoElement.src = videoURL;
    videoElement.muted = true;
    videoElement.load();
    timestamps[videoId] = 0; // Reset timestamp

    videoElement.onloadedmetadata = () => {
      resizeCanvas(canvas, videoElement);
    };
    if (videoId === "video1") {
      isVideo1 = true;
    } else {
      isVideo2 = true;
    }
  }
}

// Attach event listeners for file inputs
videoInput1.addEventListener("change", () =>
  loadVideo(videoInput1, video1, "video1", canvas1)
);
videoInput2.addEventListener("change", () =>
  loadVideo(videoInput2, video2, "video2", canvas2)
);

// Mark timestamp for a video
function markTimestamp(videoId) {
  timestamps[videoId] = document.getElementById(videoId).currentTime;
  console.log(`Marked time for ${videoId}: ${timestamps[videoId]}s`);
}

// Frame navigation
function frameStep(videoId, step) {
  const video = document.getElementById(videoId);
  video.currentTime += step;
}

// Drawing logic
let drawing = false;
let lines = { video1: [], video2: [] };

function startDrawing(e, videoId) {
  if (!drawingMode[videoId]) return;
  drawing = true;
  const canvas = videoId === "video1" ? canvas1 : canvas2;
  const rect = canvas.getBoundingClientRect();

  // Scale coordinates based on the ratio between canvas element size and actual canvas size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  lines[videoId].push({ startX: x, startY: y, endX: x, endY: y });
}

function drawLine(e, videoId) {
  if (!drawing || !drawingMode[videoId]) return;
  const canvas = videoId === "video1" ? canvas1 : canvas2;
  const rect = canvas.getBoundingClientRect();
  const lastLine = lines[videoId][lines[videoId].length - 1];

  // Scale coordinates as in startDrawing
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  lastLine.endX = (e.clientX - rect.left) * scaleX;
  lastLine.endY = (e.clientY - rect.top) * scaleY;

  redrawCanvas(videoId);
}

function stopDrawing(videoId) {
  drawing = false;
}

function redrawCanvas(videoId) {
  const canvas = videoId === "video1" ? canvas1 : canvas2;
  const ctx = videoId === "video1" ? ctx1 : ctx2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  lines[videoId].forEach((line) => {
    ctx.beginPath();
    ctx.moveTo(line.startX, line.startY);
    ctx.lineTo(line.endX, line.endY);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

// Clear lines
function clearLines(videoId) {
  lines[videoId] = [];
  redrawCanvas(videoId);
}

// Attach event listeners for drawing
canvas1.addEventListener("mousedown", (e) => startDrawing(e, "video1"));
canvas1.addEventListener("mousemove", (e) => drawLine(e, "video1"));
canvas1.addEventListener("mouseup", () => stopDrawing("video1"));

canvas2.addEventListener("mousedown", (e) => startDrawing(e, "video2"));
canvas2.addEventListener("mousemove", (e) => drawLine(e, "video2"));
canvas2.addEventListener("mouseup", () => stopDrawing("video2"));

// Toggle drawing mode
function toggleDrawing(videoId, buttonId) {
  drawingMode[videoId] = !drawingMode[videoId];

  const video = document.getElementById(videoId);
  const canvas = videoId === "video1" ? canvas1 : canvas2;
  const button = document.getElementById(buttonId);

  if (drawingMode[videoId]) {
    // Canvas is already above video thanks to CSS z-index
    canvas.style.pointerEvents = "auto"; // Enable mouse interactions with canvas
    button.style.backgroundColor = "green"; // Change button color
    button.style.color = "white";
  } else {
    // Keep canvas above video but disable pointer events
    canvas.style.pointerEvents = "none"; // Let clicks pass through to video
    button.style.backgroundColor = ""; // Reset button color
    button.style.color = "";
  }
}

// Start Looping
function startLoop() {
  let loopTime = parseFloat(document.getElementById("loopDuration").value) || 1;

  if (loopTime < 0.5) {
    alert("Loop time must be greater than or equal to 0.5 seconds!");
  }

  console.log("Video 1:", video1, "Video 2:", video2);

  if (isVideo1 && isVideo2) {
    // Both videos exist
    if (!timestamps.video1 || !timestamps.video2) {
      alert("Mark a timestamp for both videos first!");
      return;
    }

    isPaused = false;

    function loopVideos() {
      if (isPaused) return;
      video1.pause();
      video2.pause();

      let leftOfMark1 = timestamps.video1 - loopTime;
      let leftOfMark2 = timestamps.video2 - loopTime;

      if (leftOfMark1 < 0) leftOfMark1 = 0;
      if (leftOfMark2 < 0) leftOfMark2 = 0;

      video1.currentTime = leftOfMark1;
      video2.currentTime = leftOfMark2;
      video1.play();
      video2.play();
    }

    if (loopInterval) clearInterval(loopInterval);
    loopInterval = setInterval(loopVideos, loopTime * 1000 * 2); // times 2 for the right side of the Mark
    loopVideos();
  } else if (isVideo1) {
    // Only video1 exists
    if (!timestamps.video1) {
      alert("Mark a timestamp for video in slot 1!");
      return;
    }

    isPaused = false;

    function loopVideos() {
      if (isPaused) return;
      video1.pause();

      let leftOfMark1 = timestamps.video1 - loopTime;
      if (leftOfMark1 < 0) leftOfMark1 = 0;

      video1.currentTime = leftOfMark1;
      video1.play();
    }

    if (loopInterval) clearInterval(loopInterval);
    loopInterval = setInterval(loopVideos, loopTime * 1000 * 2);
    loopVideos();
  } else if (isVideo2) {
    // Only video2 exists
    if (!timestamps.video2) {
      alert("Mark a timestamp for video in slot 2!");
      return;
    }

    isPaused = false;

    function loopVideos() {
      if (isPaused) return;
      video2.pause();

      let leftOfMark2 = timestamps.video2 - loopTime;
      if (leftOfMark2 < 0) leftOfMark2 = 0;

      video2.currentTime = leftOfMark2;
      video2.play();
    }

    if (loopInterval) clearInterval(loopInterval);
    loopInterval = setInterval(loopVideos, loopTime * 1000 * 2);
    loopVideos();
  } else {
    // Neither video exists
    alert("No video slots contain videos!");
  }
}

// Stop Looping
function stopLoop() {
  clearInterval(loopInterval);
  loopInterval = null;
  isPaused = false;
  video1.pause();
  video2.pause();
}

function pauseLoop() {
  isPaused = true;
  video1.pause();
  video2.pause();
}

function resumeLoop() {
  if (!loopInterval) {
    startLoop(); // Restart loop if it was stopped
  } else {
    isPaused = false;
    video1.play();
    video2.play();
  }
}
// Attach event listeners
document
  .getElementById("back1")
  .addEventListener("click", () => frameStep("video1", -1 / 30)); // Back 1 frame (assuming 30fps)
document
  .getElementById("forward1")
  .addEventListener("click", () => frameStep("video1", 1 / 30)); // Forward 1 frame
document
  .getElementById("back2")
  .addEventListener("click", () => frameStep("video2", -1 / 30));
document
  .getElementById("forward2")
  .addEventListener("click", () => frameStep("video2", 1 / 30));
document
  .getElementById("mark1")
  .addEventListener("click", () => markTimestamp("video1"));
document
  .getElementById("mark2")
  .addEventListener("click", () => markTimestamp("video2"));
document.getElementById("loopButton").addEventListener("click", startLoop);
document.getElementById("stopButton").addEventListener("click", stopLoop);
document
  .getElementById("clear1")
  .addEventListener("click", () => clearLines("video1"));
document
  .getElementById("clear2")
  .addEventListener("click", () => clearLines("video2"));
document
  .getElementById("draw1")
  .addEventListener("click", () => toggleDrawing("video1", "draw1"));
document
  .getElementById("draw2")
  .addEventListener("click", () => toggleDrawing("video2", "draw2"));
document.getElementById("pauseButton").addEventListener("click", pauseLoop);
document.getElementById("resumeButton").addEventListener("click", resumeLoop);
document.getElementById("close").addEventListener("click", () => {
  ipcRenderer.send("close-app");
});

document.getElementById("minimize").addEventListener("click", () => {
  ipcRenderer.send("minimize-app");
});

document.getElementById("maximize").addEventListener("click", () => {
  ipcRenderer.send("maximize-app");
});

import React, { useRef, useEffect, useState } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";

export default function CameraOverlay({
  garmentImage,
  garmentType = "upper",
  gender = "male",
  scaleMultiplier = 1.0,
  verticalOffset = 0,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [garmentImgObj, setGarmentImgObj] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [poseDetected, setPoseDetected] = useState(false);
  const [debugInfo, setDebugInfo] = useState("Waiting for camera...");

  /* ---------------- Load garment image ---------------- */
  useEffect(() => {
    if (!garmentImage) {
      setGarmentImgObj(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = garmentImage;

    img.onload = () => setGarmentImgObj(img);
    img.onerror = () => console.warn("Failed to load garment image");
  }, [garmentImage]);

  /* ---------------- Main camera + pose logic ---------------- */
  useEffect(() => {
    let stopped = false;
    let pose = null;
    let camera = null;
    let animationId = null;
    let latestLandmarks = null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");

    const CANVAS_WIDTH = 640;
    const CANVAS_HEIGHT = 480;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    /* ---------------- Garment positioning ---------------- */
    function calculateGarmentPosition(landmarks, garmentImg) {
      if (!landmarks || landmarks.length < 25) return null;

      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];

      if (!leftShoulder || !rightShoulder) return null;

      const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
      const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
      const shoulderWidth =
        Math.abs(leftShoulder.x - rightShoulder.x) * CANVAS_WIDTH;

      const aspect = garmentImg.width / garmentImg.height;

      let drawWidth, drawHeight, drawX, drawY;

      if (garmentType === "bottom" && leftHip && rightHip) {
        const hipMidY = (leftHip.y + rightHip.y) / 2;
        drawWidth = shoulderWidth * 1.2 * scaleMultiplier;
        drawHeight = drawWidth / aspect;
        drawX =
          CANVAS_WIDTH -
          shoulderMidX * CANVAS_WIDTH -
          drawWidth / 2;
        drawY = hipMidY * CANVAS_HEIGHT + verticalOffset;
      } else if (garmentType === "full") {
        drawWidth = shoulderWidth * 1.3 * scaleMultiplier;
        drawHeight = CANVAS_HEIGHT * 0.7;
        drawX =
          CANVAS_WIDTH -
          shoulderMidX * CANVAS_WIDTH -
          drawWidth / 2;
        drawY =
          shoulderMidY * CANVAS_HEIGHT -
          drawHeight * 0.15 +
          verticalOffset;
      } else {
        // upper (default)
        drawWidth = shoulderWidth * 1.3 * scaleMultiplier;
        drawHeight = drawWidth / aspect;
        drawX =
          CANVAS_WIDTH -
          shoulderMidX * CANVAS_WIDTH -
          drawWidth / 2;
        drawY =
          shoulderMidY * CANVAS_HEIGHT -
          drawHeight * 0.25 +
          verticalOffset;
      }

      return { drawX, drawY, drawWidth, drawHeight };
    }

    /* ---------------- Initialize everything ---------------- */
    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });

        video.srcObject = stream;
        await video.play();

        pose = new Pose({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults((results) => {
          latestLandmarks = results.poseLandmarks;
          setPoseDetected(!!results.poseLandmarks);
        });

        camera = new Camera(video, {
          onFrame: async () => {
            if (!stopped) {
              await pose.send({ image: video });
            }
          },
          width: 640,
          height: 480,
        });

        await camera.start();

        /* ---------------- Render loop ---------------- */
        function draw() {
          if (stopped) return;

          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          // Mirror video
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(
            video,
            -CANVAS_WIDTH,
            0,
            CANVAS_WIDTH,
            CANVAS_HEIGHT
          );
          ctx.restore();

          if (latestLandmarks && garmentImgObj) {
            const pos = calculateGarmentPosition(
              latestLandmarks,
              garmentImgObj
            );

            if (pos) {
              ctx.drawImage(
                garmentImgObj,
                pos.drawX,
                pos.drawY,
                pos.drawWidth,
                pos.drawHeight
              );
              setDebugInfo("Pose detected ✓");
            } else {
              setDebugInfo("Pose detected, adjusting...");
            }
          } else {
            setDebugInfo("Move into frame to detect pose");
          }

          animationId = requestAnimationFrame(draw);
        }

        draw();
      } catch (err) {
        console.error(err);
        setCameraError(err.message);
        setDebugInfo("Camera error");
      }
    }

    init();

    /* ---------------- Cleanup ---------------- */
    return () => {
      stopped = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (camera) camera.stop();
      if (pose) pose.close();
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [garmentImgObj, garmentType, gender, scaleMultiplier, verticalOffset]);

  /* ---------------- Render ---------------- */
  return (
    <div className="video-wrap">
      <video ref={videoRef} playsInline muted style={{ display: "none" }} />
      <canvas ref={canvasRef} className="overlay-canvas" />

      {cameraError && (
        <div className="camera-error">❌ {cameraError}</div>
      )}

      <div className="debug-info">
        {poseDetected ? debugInfo : "Waiting for pose detection..."}
      </div>
    </div>
  );
}

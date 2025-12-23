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
  const [poseLoaded, setPoseLoaded] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");

  // Load garment image
  useEffect(() => {
    if (!garmentImage) {
      setGarmentImgObj(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = garmentImage;
    img.onload = () => {
      setGarmentImgObj(img);
      console.log("[overlay] garment loaded:", img.width, img.height, "Type:", garmentType, "Gender:", gender);
    };
    img.onerror = (e) => {
      console.warn("[overlay] garment load error", e);
    };
  }, [garmentImage, garmentType, gender]);

  useEffect(() => {
    let stopped = false;
    let pose = null;
    let camera = null;
    let latestLandmarks = null;
    let animationId = null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");

    function drawStatus(msg) {
      adjustCanvasToVideo();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "18px Arial";
      ctx.textAlign = "center";
      ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }

    function adjustCanvasToVideo() {
      const vw = 640;
      const vh = 480;
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
        canvas.style.width = "640px";
        canvas.style.height = "480px";
      }
    }

    // Debug function to draw landmark points
    function debugLandmarks(landmarks) {
      if (!landmarks) return;
      
      const importantLandmarks = [11, 12, 23, 24]; // Shoulders and hips
      ctx.fillStyle = 'blue';
      importantLandmarks.forEach(index => {
        if (landmarks[index]) {
          const x = canvas.width - (landmarks[index].x * canvas.width);
          const y = landmarks[index].y * canvas.height;
          ctx.fillRect(x-3, y-3, 6, 6);
        }
      });
    }

    // Fixed positioning logic
    function positionGarment(landmarks, garmentImg) {
      if (!landmarks || landmarks.length < 25) {
        console.log("Not enough landmarks detected:", landmarks?.length);
        return null;
      }

      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      
      if (!leftShoulder || !rightShoulder) {
        console.log("Shoulder landmarks missing");
        return null;
      }

      // Calculate mid points (MediaPipe coordinates are 0-1 normalized)
      const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
      const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
      
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) * canvas.width;
      const garmentAspect = garmentImg.width / garmentImg.height;

      let drawWidth, drawHeight, drawX, drawY;

      switch (garmentType) {
        case "upper":
          drawWidth = shoulderWidth * 1.3 * scaleMultiplier;
          drawHeight = drawWidth / garmentAspect;
          // FIX: Account for mirroring by subtracting from canvas.width
          drawX = canvas.width - (shoulderMidX * canvas.width) - (drawWidth / 2);
          drawY = (shoulderMidY * canvas.height) + verticalOffset - (drawHeight * 0.2);
          break;

        case "bottom":
          const hipY = leftHip && rightHip ? 
            Math.min(leftHip.y, rightHip.y) : 
            shoulderMidY + 0.3;
          drawWidth = shoulderWidth * 1.2 * scaleMultiplier;
          drawHeight = drawWidth / garmentAspect;
          drawX = canvas.width - (shoulderMidX * canvas.width) - (drawWidth / 2);
          drawY = (hipY * canvas.height) + verticalOffset;
          break;

        case "full":
          drawWidth = shoulderWidth * (gender === 'female' ? 1.2 : 1.3) * scaleMultiplier;
          drawHeight = canvas.height * 0.7;
          drawX = canvas.width - (shoulderMidX * canvas.width) - (drawWidth / 2);
          drawY = (shoulderMidY * canvas.height) + verticalOffset - (drawHeight * 0.1);
          break;

        default:
          drawWidth = shoulderWidth * 1.3 * scaleMultiplier;
          drawHeight = drawWidth / garmentAspect;
          drawX = canvas.width - (shoulderMidX * canvas.width) - (drawWidth / 2);
          drawY = (shoulderMidY * canvas.height) + verticalOffset;
      }

      console.log("Garment position:", { drawX, drawY, drawWidth, drawHeight });
      return { drawX, drawY, drawWidth, drawHeight };
    }

    async function initializeCamera() {
      try {
        adjustCanvasToVideo();
        drawStatus("Starting camera...");

        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

        video.srcObject = stream;
        
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            video.play().then(resolve);
          };
        });

        setCameraError(null);
        console.log("✓ Camera started");

        // Initialize MediaPipe Pose
        drawStatus("Loading pose detection...");
        
        pose = new Pose({
          locateFile: (file) => 
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults((results) => {
          latestLandmarks = results.poseLandmarks;
          if (!poseLoaded && results.poseLandmarks) {
            setPoseLoaded(true);
          }
        });

        await pose.initialize();
        console.log("✓ Pose model loaded");

        // Start camera processing
        camera = new Camera(video, {
          onFrame: async () => {
            if (!stopped) {
              try {
                await pose.send({ image: video });
              } catch (err) {
                console.error("Pose processing error:", err);
              }
            }
          },
          width: 640,
          height: 480
        });

        await camera.start();
        console.log("✓ MediaPipe started");

        // Start rendering loop
        function drawLoop() {
          if (stopped) return;
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw mirrored video
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
          ctx.restore();

          let debugText = "No pose detected - move into frame";
          let landmarksFound = false;

          // Draw debug landmarks
          debugLandmarks(latestLandmarks);

          // Draw garment if available and pose detected
          if (latestLandmarks && garmentImgObj) {
            try {
              const position = positionGarment(latestLandmarks, garmentImgObj);
              
              if (position) {
                landmarksFound = true;
                const { drawX, drawY, drawWidth, drawHeight } = position;

                // DEBUG: Draw position marker
                ctx.fillStyle = 'green';
                ctx.fillRect(drawX, drawY, 5, 5);
                
                // Draw the garment
                ctx.drawImage(garmentImgObj, drawX, drawY, drawWidth, drawHeight);
                
                // DEBUG: Draw bounding box
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2;
                ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);

                debugText = `✅ ${gender === 'female' ? '👩' : '👨'} ${garmentType.toUpperCase()} | Size: ${Math.round(drawWidth)}x${Math.round(drawHeight)}`;
              } else {
                debugText = "❌ Could not calculate garment position";
              }
            } catch (err) {
              console.warn("Error drawing garment:", err);
              debugText = "❌ Error drawing garment";
            }
          }

          // Update debug info
          setDebugInfo(debugText);
          
          // Show landmarks status
          if (!landmarksFound && latestLandmarks) {
            setDebugInfo("⚠️ Pose detected but missing required landmarks");
          }

          animationId = requestAnimationFrame(drawLoop);
        }

        drawLoop();

      } catch (err) {
        console.error("Initialization error:", err);
        setCameraError(err.message);
        
        if (err.name === "NotAllowedError") {
          drawStatus("Camera permission denied. Please allow camera access.");
        } else if (err.name === "NotFoundError") {
          drawStatus("No camera found.");
        } else if (err.name === "NotReadableError") {
          drawStatus("Camera is in use by another application.");
        } else {
          drawStatus(`Error: ${err.message}`);
        }
      }
    }

    initializeCamera();

    return () => {
      stopped = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (camera) camera.stop();
      if (pose) pose.close();
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [garmentImgObj, garmentType, gender, scaleMultiplier, verticalOffset, poseLoaded]);

  return (
    <div className="video-wrap">
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        className="hidden-video"
        style={{ display: 'none' }}
      />
      <canvas ref={canvasRef} className="overlay-canvas" />
      
      {cameraError && (
        <div className="camera-error">
          {cameraError}
        </div>
      )}
      
      {/* Debug Info */}
      <div className="debug-info">
        {debugInfo || "Waiting for pose detection..."}
      </div>
      
      {garmentImgObj && !poseLoaded && (
        <div className="pose-status">
          Move into frame to detect pose and overlay garment
        </div>
      )}
    </div>
  );
}
import React, { useState } from "react";
import CameraOverlay from "./components/CameraOverlay";
import { uploadGarment } from "./components/uploadApi";
import "./styles.css";

export default function App() {
  const [garment, setGarment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  
  // User preferences
  const [gender, setGender] = useState("male");
  const [garmentType, setGarmentType] = useState("upper");
  const [imageUrl, setImageUrl] = useState("");
  
  // Positioning controls
  const [scale, setScale] = useState(1.0);
  const [offsetY, setOffsetY] = useState(0);

  // Garment type options based on gender
  const garmentOptions = {
    male: [
      { value: "upper", label: "👕 Upper Wear (Shirts, T-Shirts)" },
      { value: "bottom", label: "👖 Bottom Wear (Pants, Jeans)" }
    ],
    female: [
      { value: "upper", label: "👚 Upper Wear (Tops, Blouses)" },
      { value: "bottom", label: "👗 Bottom Wear (Skirts, Pants)" },
      { value: "full", label: "👗 Full Dress (Dresses, Gowns)" }
    ]
  };

  const handleGenderChange = (newGender) => {
    setGender(newGender);
    // Reset garment type to first option when gender changes
    setGarmentType(garmentOptions[newGender][0].value);
  };

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    try {
      const result = await uploadGarment({ 
        file, 
        garmentType, 
        gender 
      });

      if (result?.ok && result.garment_image_data_url) {
        setGarment(result.garment_image_data_url);
      } else {
        const url = URL.createObjectURL(file);
        setGarment(url);
        setError(result?.error || "Backend did not return a garment image. Showing raw upload.");
      }
    } catch (err) {
      const url = URL.createObjectURL(file);
      setGarment(url);
      setError("Could not reach backend. Showing raw uploaded image.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUrlUpload() {
    if (!imageUrl.trim()) {
      setError("Please enter an image URL");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const result = await uploadGarment({ 
        imageUrl: imageUrl.trim(), 
        garmentType, 
        gender 
      });

      if (result?.ok && result.garment_image_data_url) {
        setGarment(result.garment_image_data_url);
        setImageUrl(""); // Clear URL after successful upload
      } else {
        setError(result?.error || "Failed to process image from URL");
      }
    } catch (err) {
      setError("Failed to upload image from URL: " + err.message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleClear() {
    setGarment(null);
    setError(null);
    setScale(1.0);
    setOffsetY(0);
    setImageUrl("");
  }

  return (
    <div className="app-container">
      {/* Background Elements */}
      <div className="app-background"></div>
      <div className="app-background-overlay"></div>
      
      {/* Header Section */}
      <header className="app-header">
        <h1 className="app-title">Virtual Try-On System</h1>
        <p className="app-subtitle">Try clothes virtually using AI-powered augmented reality</p>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="layout">
          <div className="controls card">
            <h3>👕 Virtual Try-On Setup</h3>

            {/* Gender Selection */}
            <div className="control-group">
              <label>🎭 Select Gender</label>
              <div className="gender-selection">
                <button 
                  className={`gender-btn ${gender === 'male' ? 'active' : ''}`}
                  onClick={() => handleGenderChange('male')}
                >
                  👨 Male
                </button>
                <button 
                  className={`gender-btn ${gender === 'female' ? 'active' : ''}`}
                  onClick={() => handleGenderChange('female')}
                >
                  👩 Female
                </button>
              </div>
            </div>

            {/* Garment Type Selection */}
            <div className="control-group">
              <label>🎽 Garment Type</label>
              <select 
                value={garmentType} 
                onChange={(e) => setGarmentType(e.target.value)}
                className="garment-select"
              >
                {garmentOptions[gender].map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* File Upload */}
            <div className="control-group">
              <label>📁 Upload Garment Image</label>
              <div className="file-input-container">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            {/* OR Separator */}
            <div className="separator">
              <span>OR</span>
            </div>

            {/* URL Upload */}
            <div className="control-group">
              <label>🔗 Enter Image URL</label>
              <div className="url-input-container">
                <input 
                  type="text" 
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="url-input"
                />
                <button 
                  onClick={handleUrlUpload}
                  className="url-upload-btn"
                  disabled={!imageUrl.trim()}
                >
                  Upload
                </button>
              </div>
              <small className="url-note">
                Tip: The system will automatically remove backgrounds and people from images
              </small>
            </div>

            {/* Status Messages */}
            {isUploading && (
              <div className="status-message status-loading">
                ⏳ Processing garment image...
              </div>
            )}
            {error && (
              <div className="status-message status-error">
                ⚠️ {error}
              </div>
            )}

            {/* Garment Controls (only show when garment is loaded) */}
            {garment && (
              <>
                <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                
                <div className="control-group">
                  <label>🎯 Garment Size: {scale.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                  />
                </div>

                <div className="control-group">
                  <label>📏 Vertical Position: {offsetY}px</label>
                  <input
                    type="range"
                    min="-150"
                    max="150"
                    step="1"
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.target.value))}
                  />
                </div>

                <button onClick={handleClear} className="clear-btn">
                  🗑️ Clear Garment
                </button>
              </>
            )}
          </div>

          <div className="preview">
            <h3>Live Preview</h3>
            <p className="instructions">
              Stand clearly in frame with good lighting for best results.<br />
              The system will automatically detect your pose and overlay the garment.
            </p>

            <CameraOverlay
              garmentImage={garment}
              garmentType={garmentType}
              gender={gender}
              scaleMultiplier={scale}
              verticalOffset={offsetY}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
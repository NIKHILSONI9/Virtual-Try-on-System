async function urlToDataUrl(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}

export async function uploadGarment({ file, imageUrl, garmentType = "upper", gender = "male" }) {
  const fd = new FormData();
  
  if (file) {
    fd.append("file", file);
  } else if (imageUrl) {
    fd.append("image_url", imageUrl);
  } else {
    return { ok: false, error: "No file or image URL provided" };
  }
  
  fd.append("garment_type", garmentType);
  fd.append("gender", gender);
  fd.append("do_remove_bg", "true");

  try {
    const resp = await fetch("http://localhost:8000/upload", {
      method: "POST",
      body: fd,
    });
    const data = await resp.json();
    console.log("[uploadApi] response:", data);

    if (data?.garment_data_url) {
      return { 
        ok: true, 
        garment_image_data_url: data.garment_data_url, 
        garment_type: data.garment_type || garmentType, 
        gender: data.gender || gender,
        raw: data 
      };
    }

    if (data?.garment_png_b64) {
      let b64 = data.garment_png_b64;
      const dataUrl = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
      return { 
        ok: true, 
        garment_image_data_url: dataUrl, 
        garment_type: data.garment_type || garmentType,
        gender: data.gender || gender,
        raw: data 
      };
    }

    return { ok: false, error: "No garment data returned", raw: data };
  } catch (err) {
    console.error("[uploadApi] upload failed:", err);
    return { ok: false, error: err?.message || String(err) };
  }
}
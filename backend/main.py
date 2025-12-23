# backend/main.py
import io
import base64
import logging
from typing import Optional, Any, Dict
from urllib.parse import urlparse

import requests
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageStat, ImageChops, ImageFilter, ImageOps, UnidentifiedImageError

# Optional rembg import for high-quality background removal
try:
    from rembg import remove as rembg_remove  # type: ignore
    REMBG_AVAILABLE = True
except Exception:
    REMBG_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("virtual-tryon-backend")

app = FastAPI(title="Virtual Try-On Backend")

# Permissive CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB
MAX_DIMENSION = 2048


def fetch_image_from_url(url: str, timeout: float = 8.0) -> bytes:
    logger.info("Fetching remote image: %s", url)
    try:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
    except Exception as e:
        logger.error("Failed to fetch remote image %s: %s", url, e)
        raise HTTPException(status_code=400, detail=f"Failed to fetch remote image: {e}")
    return resp.content


def pil_open_image(img_bytes: bytes) -> Image.Image:
    try:
        im = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    except UnidentifiedImageError:
        logger.exception("Uploaded bytes are not a valid image")
        raise HTTPException(status_code=400, detail="File is not a valid image")
    return im


def downscale_if_needed(im: Image.Image, max_dim: int = MAX_DIMENSION) -> Image.Image:
    w, h = im.size
    if max(w, h) <= max_dim:
        return im
    scale = max_dim / max(w, h)
    new_w, new_h = int(w * scale), int(h * scale)
    logger.info("Downscaling image from (%d,%d) to (%d,%d)", w, h, new_w, new_h)
    return im.resize((new_w, new_h), Image.LANCZOS)


def color_distance_sq(c1, c2):
    dr = c1[0] - c2[0]
    dg = c1[1] - c2[1]
    db = c1[2] - c2[2]
    return dr * dr + dg * dg + db * db


def estimate_background_color(im: Image.Image, sample_size: int = 10):
    w, h = im.size
    corners = [
        im.crop((0, 0, min(sample_size, w), min(sample_size, h))),
        im.crop((max(0, w - sample_size), 0, w, min(sample_size, h))),
        im.crop((0, max(0, h - sample_size), min(sample_size, w), h)),
        im.crop((max(0, w - sample_size), max(0, h - sample_size), w, h)),
    ]
    sums = [0, 0, 0]
    count = 0
    for c in corners:
        stat = ImageStat.Stat(c)
        if stat.count and stat.count[0] > 0:
            sums[0] += stat.mean[0]
            sums[1] += stat.mean[1]
            sums[2] += stat.mean[2]
            count += 1
    if count == 0:
        return (255, 255, 255)
    return (int(sums[0] / count), int(sums[1] / count), int(sums[2] / count))


def pillow_bg_remove(im: Image.Image, threshold: int = 45, smooth_radius: int = 3, min_fg_fraction: float = 0.001):
    rgb = im.convert("RGB")
    bg_color = estimate_background_color(rgb, sample_size=10)
    w, h = im.size
    pix = rgb.load()
    mask = Image.new("L", (w, h), 0)
    m = mask.load()
    thr_sq = threshold * threshold
    fg_count = 0
    for y in range(h):
        for x in range(w):
            r, g, b = pix[x, y]
            if color_distance_sq((r, g, b), bg_color) > thr_sq:
                m[x, y] = 255
                fg_count += 1
            else:
                m[x, y] = 0
    fg_fraction = fg_count / (w * h)
    if fg_fraction < min_fg_fraction and threshold > 20:
        return pillow_bg_remove(im, max(20, threshold - 15), smooth_radius, min_fg_fraction)
    try:
        for i in range(smooth_radius):
            mask = mask.filter(ImageFilter.MaxFilter(3))
        for i in range(smooth_radius):
            mask = mask.filter(ImageFilter.MinFilter(3))
    except Exception:
        pass
    mask = mask.filter(ImageFilter.GaussianBlur(radius=1))
    rgba = im.convert("RGBA")
    rgba.putalpha(mask)
    return rgba


def remove_background(im: Image.Image, do_rembg: bool = True) -> Image.Image:
    if REMBG_AVAILABLE and do_rembg:
        try:
            logger.info("Removing background with rembg")
            buf_in = io.BytesIO()
            im.save(buf_in, format="PNG")
            out_bytes = rembg_remove(buf_in.getvalue())
            out_im = Image.open(io.BytesIO(out_bytes)).convert("RGBA")
            return out_im
        except Exception:
            logger.exception("rembg failed; falling back to pillow heuristic")
    return pillow_bg_remove(im, threshold=45, smooth_radius=3)


def pil_to_base64_png(im: Image.Image) -> str:
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    png_bytes = buf.getvalue()
    return base64.b64encode(png_bytes).decode("ascii")


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"ok": "true", "service": "virtual-tryon-backend", "rembg_installed": str(REMBG_AVAILABLE)}


@app.post("/upload")
async def upload_garment(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    base64_image: Optional[str] = Form(None),
    garment_type: Optional[str] = Form("upper"),
    gender: Optional[str] = Form("male"),
    do_remove_bg: Optional[bool] = Form(True),
) -> Any:
    try:
        img_bytes: Optional[bytes] = None
        if file is not None:
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="Empty file")
            if len(data) > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Uploaded file too large")
            img_bytes = data
        elif image_url:
            parsed = urlparse(image_url)
            if parsed.scheme not in ("http", "https"):
                raise HTTPException(status_code=400, detail="image_url must be http(s)")
            img_bytes = fetch_image_from_url(image_url)
            if len(img_bytes) > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Remote image too large")
        elif base64_image:
            if base64_image.startswith("data:"):
                try:
                    _, b64 = base64_image.split(",", 1)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid data URL")
                img_bytes = base64.b64decode(b64)
            else:
                try:
                    img_bytes = base64.b64decode(base64_image)
                except Exception:
                    raise HTTPException(status_code=400, detail="Provided base64_image is not valid base64")
        else:
            raise HTTPException(status_code=400, detail="No file/image_url/base64_image provided")

        im = pil_open_image(img_bytes)
        im = downscale_if_needed(im, MAX_DIMENSION)
        
        # Always remove background for virtual try-on
        if do_remove_bg:
            im = remove_background(im, do_rembg=True)
        else:
            if im.mode != "RGBA":
                im = im.convert("RGBA")

        b64_png = pil_to_base64_png(im)
        data_url = f"data:image/png;base64,{b64_png}"

        response = {
            "ok": True,
            "garment_png_b64": b64_png,
            "garment_data_url": data_url,
            "garment_type": garment_type or "upper",
            "gender": gender or "male",
        }
        logger.info("Upload processed: gender=%s garment_type=%s b64_len=%d", gender, response["garment_type"], len(b64_png))
        return JSONResponse(response)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unhandled error in /upload")
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=500)
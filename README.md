
---

# 🧥 Virtual Try-On System

A **Virtual Try-On System** that allows users to visualize how clothing items look on a person using computer vision and deep learning techniques.
The system processes an input human image and overlays selected garments realistically, helping users preview outfits digitally.

---

## 📌 Features

* Upload a person image
* Select clothing item(s)
* Virtual garment overlay on human image
* Backend powered by **Python + FastAPI**
* Image processing using **OpenCV, NumPy, SciPy, scikit-image**
* REST API for easy frontend integration

---

## 🗂️ Project Structure

```
virtual-tryon/
│
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI entry point
│   │   ├── routes/                # API routes
│   │   ├── services/              # Business logic (try-on processing)
│   │   ├── models/                # ML / CV related logic
│   │   └── utils/                 # Helper functions
│   │
│   ├── requirements.txt           # Backend dependencies
│   └── README.md                  # Backend-specific notes (optional)
│
├── frontend/                      # (Optional / if applicable)
│   ├── src/
│   ├── public/
│   └── package.json
│
├── .gitignore                     # Ignored files (venv, cache, etc.)
├── README.md                      # Project documentation (this file)
└── requirements.txt               # (Optional global requirements)
```

> ⚠️ **Important:**
> The `.venv/` folder is intentionally NOT included in the repository.

---

## ⚙️ Tech Stack

### Backend

* Python 3.9+
* FastAPI
* Uvicorn
* OpenCV
* NumPy
* SciPy
* scikit-image

### Frontend (if present)

* HTML / CSS / JavaScript
  or
* React (optional)

---

## 🛠️ Setup Instructions (From Scratch)

Follow these steps **exactly in order**.

---

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/NIKHILSONI9/Virtual-Try-on-System.git
cd Virtual-Try-on-System
```

---

## 2️⃣ Create Python Virtual Environment

```bash
python3 -m venv .venv
```

Activate it:

### macOS / Linux

```bash
source .venv/bin/activate
```

### Windows

```bash
.venv\Scripts\activate
```

---

## 3️⃣ Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

If `requirements.txt` does not exist yet, create it using:

```bash
pip freeze > requirements.txt
```

---

## 4️⃣ Start the Backend Server

```bash
uvicorn app.main:app --reload
```

You should see output like:

```
Uvicorn running on http://127.0.0.1:8000
```

---

## 5️⃣ Open API Documentation

FastAPI provides automatic API docs:

* Swagger UI:
  👉 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

* ReDoc:
  👉 [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 6️⃣ Using the Virtual Try-On API

Typical flow:

1. Upload a **person image**
2. Upload/select a **garment image**
3. Backend processes images
4. Returns **virtual try-on result**

API endpoints will be available in `/docs`.

---

## 🧪 Example Test (API Health Check)

```bash
curl http://127.0.0.1:8000
```

Expected response:

```json
{
  "message": "Virtual Try-On API is running"
}
```

---

## 📦 Environment Variables (Optional)

Create a `.env` file in `backend/` if required:

```env
PORT=8000
DEBUG=true
```

---

## 🚫 What NOT to Commit

These are ignored via `.gitignore`:

* `.venv/`
* `__pycache__/`
* `*.pyc`
* `.env`
* `node_modules/`

---

## 🧑‍💻 Development Workflow

```bash
# Activate environment
source .venv/bin/activate

# Run backend
cd backend
uvicorn app.main:app --reload
```

---

## 🚀 Future Improvements

* Add user authentication
* Improve garment alignment accuracy
* Add frontend UI
* Add Docker support
* Optimize model inference speed

---

## 👤 Author

**Nikhil Soni**
GitHub: [https://github.com/NIKHILSONI9](https://github.com/NIKHILSONI9)

---

## 📄 License

This project is for **educational and research purposes**.



# NID Photo Extraction: Implementation and API Guide

## What the current tool uses

The website does **not** call an external AI API. Images are processed locally in the user's browser, so NID scans are never uploaded to a server.

- **Image processing runtime:** OpenCV.js, `@techstark/opencv-js` version `5.0.0-release.1`
- **Face detection model:** OpenCV YuNet
- **Model file:** `face_detection_yunet_2023mar.onnx`
- **Model format:** ONNX
- **Model size:** approximately 228 KB
- **Model source:** https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
- **Browser runtime:** `public/opencv.js`
- **Local model:** `public/face_detection_yunet.onnx`
- **Implementation:** `src/pages/tools/photo-extraction.astro`

YuNet is a lightweight face detector. It returns a bounding box, five facial landmarks, and a confidence score for every detected face. It detects faces; it does **not** identify people or perform facial recognition.

## Processing pipeline

### 1. Read the image

The browser accepts JPG, PNG, and WebP files. It loads each file into an image element and then draws it onto an HTML canvas.

For detection, the image is scaled down to a maximum dimension of 1400 pixels. This reduces processing time and memory usage. The detected coordinates are converted back to the original canvas coordinates before cropping.

### 2. Detect the portrait

OpenCV loads the YuNet ONNX model into its in-memory filesystem. A `FaceDetectorYN` detector is created with:

```js
const detector = new cv.FaceDetectorYN(
  "face.onnx",                    // model
  "",                            // optional config
  new cv.Size(width, height),     // input dimensions
  0.55,                          // confidence threshold
  0.3,                           // non-maximum suppression threshold
  5000                           // maximum candidates before NMS
);
```

The tool selects the largest detected face. On an NID scan, this is normally the printed portrait rather than a smaller face printed on the back of the card.

### 3. Correct orientation

The detector first tries the original orientation. If no face is found, it tries rotations of 90°, 270°, and 180°.

YuNet also returns the eye positions. The tool calculates the angle between the eyes:

```text
angle = atan2(rightEyeY - leftEyeY, rightEyeX - leftEyeX)
```

The extracted portrait is rotated by the negative of that angle to level the face. Roll correction is limited to angles below 30° to avoid large rotations caused by inaccurate landmarks.

### 4. Crop a square portrait

The crop uses the detected face box with additional space for the head and shoulders:

```text
cropSide = max(faceWidth, faceHeight) × 1.65
centerX  = faceX + faceWidth / 2
centerY  = faceY + faceHeight × 0.57
```

The crop is clamped to the image boundaries. It is then resized to exactly **300 × 300 pixels** using high-quality canvas interpolation. The face is not stretched because the source crop is square.

### 5. Compress the JPEG

The output canvas is encoded as JPEG, initially at quality `0.90`. If necessary, the tool retries at:

```text
0.82 → 0.74 → 0.66 → 0.58 → 0.50
```

The final file is guaranteed to be no larger than **300 KB** for a 300×300 output under normal browser JPEG encoding. In testing, the supplied samples produced files between approximately **8.3 KB and 12.7 KB**.

## Suggested server API

For a future API, use **FastAPI + OpenCV Python + the same YuNet ONNX model**. This preserves the current detection approach without requiring a GPU or a large machine-learning framework.

### Suggested dependencies

```txt
fastapi
uvicorn[standard]
opencv-python-headless
numpy
python-multipart
Pillow
```

Use `opencv-python-headless` on servers because it does not require desktop GUI libraries.

### Endpoint contract

```http
POST /v1/nid/extract-photo
Content-Type: multipart/form-data
```

Form field:

```text
file: JPG, PNG, or WebP image
```

Successful response:

```http
HTTP/1.1 200 OK
Content-Type: image/jpeg
Content-Disposition: attachment; filename="nid-photo-300x300.jpg"
X-Photo-Width: 300
X-Photo-Height: 300
X-Photo-Size-Bytes: 11240
X-Face-Confidence: 0.94
X-Orientation-Correction: 0
```

The response body is the processed JPEG itself. This is simpler for browser downloads than embedding a large base64 image in JSON.

Example error:

```json
{
  "detail": "No portrait was detected. Upload a sharper NID image."
}
```

Recommended status codes:

- `200`: portrait extracted
- `400`: no face detected or invalid dimensions
- `413`: uploaded file too large
- `415`: unsupported image type
- `422`: missing upload field
- `500`: unexpected processing failure

## FastAPI reference implementation

The following is a starting point, not the browser tool's production code. Store `face_detection_yunet_2023mar.onnx` at `models/face_detection_yunet.onnx`.

```python
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps

app = FastAPI(title="NID Photo Extraction API")

MODEL_PATH = Path(__file__).parent / "models" / "face_detection_yunet.onnx"
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_DETECTION_DIMENSION = 1400
OUTPUT_SIZE = 300
MAX_OUTPUT_BYTES = 300 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def decode_image(contents: bytes) -> np.ndarray:
    # Pillow applies EXIF orientation before OpenCV sees the pixels.
    with Image.open(BytesIO(contents)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        rgb = np.asarray(image)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def rotate_image(image: np.ndarray, quarter_turns: int) -> np.ndarray:
    if quarter_turns == 1:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    if quarter_turns == 2:
        return cv2.rotate(image, cv2.ROTATE_180)
    if quarter_turns == 3:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return image


def detect_largest_face(image: np.ndarray):
    height, width = image.shape[:2]
    scale = min(1.0, MAX_DETECTION_DIMENSION / max(width, height))
    resized = cv2.resize(image, None, fx=scale, fy=scale)

    detector = cv2.FaceDetectorYN.create(
        str(MODEL_PATH),
        "",
        (resized.shape[1], resized.shape[0]),
        0.55,  # confidence threshold
        0.3,   # NMS threshold
        5000,
    )
    _, faces = detector.detect(resized)

    if faces is None or len(faces) == 0:
        return None

    face = max(faces, key=lambda item: item[2] * item[3]).copy()
    face[:14] /= scale
    return face


def find_face(image: np.ndarray):
    # Try upright first, then clockwise 90°, 180°, and 270°.
    for quarter_turns in (0, 1, 2, 3):
        oriented = rotate_image(image, quarter_turns)
        face = detect_largest_face(oriented)
        if face is not None:
            return oriented, face, quarter_turns * 90
    return None


def extract_portrait(image: np.ndarray, face: np.ndarray) -> np.ndarray:
    x, y, width, height = face[:4]
    side = max(width, height) * 1.65
    center_x = x + width / 2
    center_y = y + height * 0.57

    left = max(0, min(image.shape[1] - side, center_x - side / 2))
    top = max(0, min(image.shape[0] - side, center_y - side / 2))

    crop = image[
        round(top):round(top + side),
        round(left):round(left + side),
    ]
    return cv2.resize(crop, (OUTPUT_SIZE, OUTPUT_SIZE), interpolation=cv2.INTER_AREA)


def encode_jpeg(image: np.ndarray) -> bytes:
    for quality in (90, 82, 74, 66, 58, 50):
        success, encoded = cv2.imencode(
            ".jpg",
            image,
            [cv2.IMWRITE_JPEG_QUALITY, quality],
        )
        if not success:
            raise HTTPException(500, "JPEG encoding failed")
        contents = encoded.tobytes()
        if len(contents) <= MAX_OUTPUT_BYTES:
            return contents
    raise HTTPException(500, "Could not compress portrait below 300 KB")


@app.post("/v1/nid/extract-photo")
async def extract_photo(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Upload a JPG, PNG, or WebP image")

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image exceeds the 15 MB upload limit")

    try:
        original = decode_image(contents)
    except Exception:
        raise HTTPException(400, "The uploaded image could not be decoded")

    detection = find_face(original)
    if detection is None:
        raise HTTPException(400, "No portrait was detected. Upload a sharper NID image.")

    oriented, face, rotation = detection
    portrait = extract_portrait(oriented, face)
    jpeg = encode_jpeg(portrait)

    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": 'attachment; filename="nid-photo-300x300.jpg"',
            "X-Photo-Width": str(OUTPUT_SIZE),
            "X-Photo-Height": str(OUTPUT_SIZE),
            "X-Photo-Size-Bytes": str(len(jpeg)),
            "X-Face-Confidence": f"{float(face[14]):.4f}",
            "X-Orientation-Correction": str(rotation),
            "Cache-Control": "no-store",
        },
    )
```

Run it with:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Example request:

```bash
curl -X POST "http://localhost:8000/v1/nid/extract-photo" \
  -F "file=@nid.jpeg" \
  --output portrait.jpg
```

## Important production additions

The reference implementation covers detection, cropping, resizing, and compression. Before deploying it publicly, also add:

1. **Eye-level roll correction:** YuNet face columns `4:8` contain the two eye landmarks. Apply the same `atan2` correction used by the browser implementation.
2. **Request size limits:** Enforce limits at the reverse proxy as well as in FastAPI.
3. **Pixel limits:** Reject decompression bombs and extremely large dimensions before full decoding where possible.
4. **Timeouts and concurrency limits:** CPU inference should run in a controlled worker pool, not with unbounded parallel requests.
5. **No persistent storage:** Process in memory and never write NID uploads to logs or temporary files.
6. **Privacy headers:** Use `Cache-Control: no-store`; do not include personal information in URLs.
7. **Rate limiting and authentication:** Protect the public endpoint from abuse.
8. **CORS:** Allow only the frontend origins that need browser access.
9. **Tests:** Keep representative consented test images and assert output dimensions, JPEG size, orientation, and failure behavior.
10. **Model integrity:** Pin the model file in the repository or artifact store and verify its checksum during deployment.

## Measured sample results

All six supplied NID samples were processed successfully by the browser implementation:

| Sample | Output dimensions | Approximate JPEG size |
|---|---:|---:|
| `1.jpeg` | 300 × 300 px | 9.6 KB |
| `2.jpeg` | 300 × 300 px | 8.3 KB |
| `3.jpeg` | 300 × 300 px | 11.0 KB |
| `4.jpeg` | 300 × 300 px | 11.9 KB |
| `6.jpeg` | 300 × 300 px | 12.7 KB |
| `7.jpeg` | 300 × 300 px | 8.8 KB |

These file sizes are test observations, not guarantees for every image. Complex or noisy images can produce larger JPEGs, which is why the quality-reduction loop is retained.

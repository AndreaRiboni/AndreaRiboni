from hashlib import blake2b
from io import BytesIO
import math
import os
from pathlib import Path

import concurrent
import sqlite3
import math
import cv2
import numpy as np

# Set the working directory to the project root
import sys

os.chdir(Path(__file__).resolve().parent.parent.parent)
sys.path.append(str(Path.cwd()))

from PIL import Image

import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor


ONE_YEAR = 60 * 60 * 24 * 365  # Cache‑Control max‑age

def pad_image_to_pow2(image: np.ndarray, tile_size: int = 256):
    h, w = image.shape[:2]
    new_w = int(2 ** math.ceil(math.log2(w)))
    new_h = int(2 ** math.ceil(math.log2(h)))
    if len(image.shape) == 3:
        padded = np.zeros((new_h, new_w, image.shape[2]), dtype=image.dtype)
    else:
        padded = np.zeros((new_h, new_w), dtype=image.dtype)
    padded[:h, :w] = image
    return padded, (w, h)


# ─── new imports ────────────────────────────────────────────────────────────────
from pymbtiles import MBtiles  #  NEW
from pymbtiles import Tile as MBTileCoordinate  #  (optional helper)


# ─── MBTiles helpers ────────────────────────────────────────────────────────────
def _write_png_tile(mb: MBtiles, z: int, x: int, y: int, tile_arr: np.ndarray) -> None:
    """
    Encode a numpy tile to PNG bytes and write it into an open MBTiles handle.
    """
    ok, buf = cv2.imencode(".png", tile_arr)
    if not ok:
        raise RuntimeError("cv2.imencode() failed")

    mb.write_tile(z=z, x=x, y=y, data=buf.tobytes())


def generate_leaflet_mbtiles(
    *, image: np.ndarray, tile_size: int, db_path: Path, metadata: dict | None = None
) -> None:
    """
    Build a complete MBTiles file (XYZ schema, 0/0/0 at full-image view).

    Args:
        image (np.ndarray):  8-bit RGB or single-band uint16/uint8 image.
        tile_size (int):     Usually 256.
        db_path (Path):      Destination *.mbtiles path.
        metadata (dict):     Optional MBTiles metadata (name, bounds, etc.).
    """
    # 1) Pad so that width == height == power-of-two
    padded, (orig_w, orig_h) = pad_image_to_pow2(image, tile_size)
    H, W = padded.shape[:2]
    max_zoom = int(math.log2(max(W, H) // tile_size))

    # 2) Create/overwrite the database

    with MBtiles(db_path, mode="w") as mb:
        # meta can be set at any point while the file is open
        if metadata:
            mb.meta = metadata

        for z in range(max_zoom + 1):
            scale = 2 ** (max_zoom - z)  # down-scale factor
            level_w, level_h = W // scale, H // scale

            level_img = cv2.resize(
                padded, (level_w, level_h), interpolation=cv2.INTER_LINEAR
            )

            tiles_x = level_w // tile_size
            tiles_y = level_h // tile_size

            for x in range(tiles_x):
                for y in range(tiles_y):
                    tile = level_img[
                        y * tile_size : (y + 1) * tile_size,
                        x * tile_size : (x + 1) * tile_size,
                    ]
                    _write_png_tile(mb, z, x, y, tile)

        # Example of setting additional required/optional keys
        mb.meta.setdefault("format", "png")
        mb.meta.setdefault("minzoom", 0)
        mb.meta.setdefault("maxzoom", max_zoom)

if __name__ == "__main__":
    start_time = time.time()

    # 1. Load image from disk using OpenCV (in BGR format by default)
    input_path = r"C:\\Users\\Andrea\\Documenti\\AndreaRiboni\\overall.png"
    raw_u16 = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)  # Supports 8/16 bit, grayscale or color

    if raw_u16 is None:
        raise FileNotFoundError(f"Could not load image from {input_path}")

    # 2. Set output path
    db_path = Path.cwd() / "map.mbtiles"

    # 3. Generate MBTiles
    generate_leaflet_mbtiles(
        image=raw_u16,
        tile_size=256,
        db_path=db_path,
        metadata={
            "name": "overall",
            "description": "Auto-generated MBTiles from overall.png",
        },
    )
    
    db_path.chmod(0o777)

    end_time = time.time()
    print(f"Execution time: {end_time - start_time:.2f} seconds")

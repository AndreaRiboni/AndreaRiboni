from PIL import Image
import numpy as np
from pathlib import Path
from collections import Counter

def estimate_block_size(image: Image.Image, max_size: int = 64) -> int:
    """
    Estimate the size of logical pixels by analyzing horizontal/vertical pixel differences.
    """
    gray = image.convert("L")
    arr = np.array(gray)

    # Horizontal diff
    h_diff = np.abs(np.diff(arr, axis=1))
    h_sum = np.sum(h_diff, axis=0)

    # Vertical diff
    v_diff = np.abs(np.diff(arr, axis=0))
    v_sum = np.sum(v_diff, axis=1)

    # Detect peaks in the difference sum
    def detect_periodicity(diff_sum, axis="x"):
        peaks = []
        threshold = np.percentile(diff_sum, 90)
        for i, val in enumerate(diff_sum):
            if val > threshold:
                peaks.append(i)
        # Compute distances between peaks
        deltas = [b - a for a, b in zip(peaks, peaks[1:]) if 1 < b - a <= max_size]
        if not deltas:
            return None
        # Return the most common spacing
        return Counter(deltas).most_common(1)[0][0]

    horizontal_period = detect_periodicity(h_sum, "x")
    vertical_period = detect_periodicity(v_sum, "y")

    if horizontal_period and vertical_period:
        return int(round((horizontal_period + vertical_period) / 2))
    elif horizontal_period:
        return horizontal_period
    elif vertical_period:
        return vertical_period
    else:
        raise ValueError("Could not determine block size")

def convert_image_to_pixel_art(image_path: str, output_path: str, upscale_factor: int = 16):
    img = Image.open(image_path)
    block_size = estimate_block_size(img) 
    block_size = 8

    print(f"Estimated pixel block size: {block_size}×{block_size}")

    w, h = img.size
    print(img.size)
    new_w, new_h = w // block_size, h // block_size

    # Resize down to true pixel art resolution
    downscaled = img.resize((new_w, new_h), resample=Image.NEAREST)

    # Optional: upscale for display
    downscaled.save(output_path)
    print(f"Saved pixel art to {output_path}")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    file_name = "ferrari"
    parser.add_argument("--input", help="Path to the input DALL·E image", default=f"C:\\Users\\Andrea\\Downloads\\{file_name}.png")
    parser.add_argument("--output", help="Path to save the pixel-art output", default=f"./{file_name}.png")
    parser.add_argument("--upscale", type=int, default=16, help="Upscale factor for final output (default: 16)")
    args = parser.parse_args()

    convert_image_to_pixel_art(args.input, args.output, args.upscale)

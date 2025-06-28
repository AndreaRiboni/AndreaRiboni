#!/usr/bin/env python3
"""
Generate a tile-based map with smooth biome-edge blending using gradient transitions.

Revision 4 – Gradient-based biome blending
-----------------------------------------
* Implemented gradient-based biome blending for smoother transitions
* Added color interpolation between adjacent biomes
* Introduced transition zones with blended colors
* Preserved tile shapes while modifying colors for blending
* Configurable transition width and intensity

Usage
~~~~~
::

    $ python generate_map_blended.py  # uses defaults
    $ python generate_map_blended.py --blend-width 3 --seed 42
"""

from pathlib import Path
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
import numpy as np
import argparse
from collections import defaultdict
import math
from random import Random
from noise import pnoise2
rand = Random(42)

# ---------- CONFIGURATION ----------------------------------------------------
TILE_SIZE = 32
MAP_PATH = "homepage/experiments/explorer_map/handdrawn_map.TIF"
MAP_PATH_1 = "homepage/experiments/explorer_map/handdrawn_map_1.TIF"
MAP_PATH_2 = "homepage/experiments/explorer_map/handdrawn_map_2.TIF"
MAP_TREES = "homepage/experiments/explorer_map/handdrawn_map_tree.TIF"
MAP_ROADS = "homepage/experiments/explorer_map/handdrawn_map_road.TIF"
TILESET_DIR = "tiles"
OUTPUT_PATH = "output_map.png"
# Settings
SCALE = 0.01  # controls frequency of noise
BRIGHTNESS_MIN = 0.6
BRIGHTNESS_MAX = 1.4
SCATTER_PROB = 0.1  # 10% chance at biome boundary

# --- Blending ----------------------------------------------------------------
DEFAULT_BLEND_WIDTH = 6       # Width of transition zone in pixels
DEFAULT_BLEND_INTENSITY = 1.0 # Blend strength (0.0-1.0)
DEFAULT_SCATTER_INTENSITY = 0.3  # Jitter strength (0.0-1.0)
DEFAULT_RNG_SEED = None       # Set to an int for deterministic output

# Base colors for biome blending
BIOME_COLORS = {
    "grass": (56, 170, 74),    # 38aa4a
    "sand": (184, 126, 55),    # b87e37
    "stone": (152, 152, 152),  # 989898
    "water": (57, 81, 171),    # 3951ab
}

COLOR_TO_TYPE = {
    # Water is the background - everything else is considered "land"
    "3951ab": "water",
    "38aa4a": "grass",
    "b87e37": "sand",
    "989898": "stone",
}

# Legacy grass + water tiles with bespoke names --------------------------------
TILE_MAPPING = {
    ("water", None): "tile_20.png",

    # Grass edges / outer corners
    ("grass", "center"): "grass/tile_14.png",
    ("grass", "top"): "grass/tile_1.png",
    ("grass", "left"): "grass/tile_13.png",
    ("grass", "bottom"): "grass/tile_27.png",
    ("grass", "bottom-right"): "grass/tile_28.png",
    ("grass", "top-left"): "grass/tile_0.png",

    # Internal-corner overlays (mirrors generated at runtime)
    ("grass", "center_top_left"): "grass/intra_tile_top_left.png",
    ("grass", "center_bottom_right"): "grass/intra_tile_bottom_right.png",
}

# Shapes that can be produced by mirroring another canonical tile -------------
FLIP_MAP = {
    "right": ("left", True),
    "top-right": ("top-left", True),
    "bottom-left": ("bottom-right", True),
}

DIAGONALS = ["top-left", "top-right", "bottom-right", "bottom-left"]
CARDINALS = ["top", "bottom", "left", "right"]

# Helper: mapping our shape names → numerical ID in <material>_tile_<id>.png ---
SHAPE_TO_ID = {
    "center": 0,
    "top": 1,
    "left": 2,
    "bottom": 3,
    "bottom-right": 4,
    "top-left": 5,
    "center_top_left": 6,
    "center_bottom_right": 7,
}

# ---------- UTILS -------------------------------------------------------------

def jitter_ratio(base_ratio, scatter_intensity, rng):
    delta = (rng.random() * 2 - 1) * scatter_intensity
    return np.clip(base_ratio + delta, 0.0, 1.0)

def hex_to_rgb(hex_str: str):
    return tuple(int(hex_str[i : i + 2], 16) for i in (0, 2, 4))

def closest_palette_key(rgb, palette):
    arr = np.array([hex_to_rgb(k) for k in palette])
    rgb_arr = np.array(rgb)
    dists = np.sqrt(np.sum((arr - rgb_arr) ** 2, axis=1))
    return list(palette)[np.argmin(dists)]

def is_water(pixel_rgba):
    """
    Return True if alpha < 127 (transparent pixel), else
    classify by RGB against the palette.
    """
    # pixel_rgba is (R, G, B, A)
    if pixel_rgba[3] < 127:
        return True
    # only pass RGB channels into the palette matcher
    return COLOR_TO_TYPE.get(
        closest_palette_key(pixel_rgba[:3], COLOR_TO_TYPE)
    ) == "water"

def is_grass(pixel_rgba):
    """Use only RGB channels for grass test."""
    return COLOR_TO_TYPE.get(
        closest_palette_key(pixel_rgba[:3], COLOR_TO_TYPE)
    ) == "grass"

def load_tileset(tile_dir: str, alternate_version = False):
    tiles = {}
    for key, filename in TILE_MAPPING.items():
        if key[0] == "grass" and alternate_version and key[1] != "center":
            filename = filename.replace(".png", "_plain.png")
        path = Path(tile_dir) / filename
        if not path.exists():
            raise FileNotFoundError(f"Missing tile image: {path}")
        tiles[key] = Image.open(path).convert("RGBA").resize((TILE_SIZE, TILE_SIZE))
    for material in ("sand", "stone"):
        for shape, idx in SHAPE_TO_ID.items():
            path = Path(tile_dir) / f"{material}_tile_{idx}.png"
            if not path.exists():
                if shape == "center":
                    raise FileNotFoundError(f"Missing required tile: {path}")
                continue
            tiles[(material, shape)] = Image.open(path).convert("RGBA").resize((TILE_SIZE, TILE_SIZE))
    return tiles

def get_neighbors(arr: np.ndarray, x: int, y: int, predicate, default_val):
    h, w, _ = arr.shape
    offsets = [(-1,-1),(0,-1),(1,-1),(-1,0),(0,0),(1,0),(-1,1),(0,1),(1,1)]
    keys    = ["top-left","top","top-right","left","center","right",
               "bottom-left","bottom","bottom-right"]
    result = {}
    for (dx, dy), k in zip(offsets, keys):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h:
            result[k] = predicate(tuple(arr[ny, nx]))
        else:
            result[k] = default_val
    return result

def classify_grass_shape(neigh_grass: dict):
    if not neigh_grass["top"] and not neigh_grass["left"]:
        return "top-left"
    if not neigh_grass["top"] and not neigh_grass["right"]:
        return "top-right"
    if not neigh_grass["bottom"] and not neigh_grass["left"]:
        return "bottom-left"
    if not neigh_grass["bottom"] and not neigh_grass["right"]:
        return "bottom-right"
    if not neigh_grass["top"]:
        return "top"
    if not neigh_grass["bottom"]:
        return "bottom"
    if not neigh_grass["left"]:
        return "left"
    if not neigh_grass["right"]:
        return "right"
    return "center"

def classify_by_water(neigh_water: dict):
    if neigh_water["top"] and neigh_water["left"]:
        return "top-left"
    if neigh_water["top"] and neigh_water["right"]:
        return "top-right"
    if neigh_water["bottom"] and neigh_water["left"]:
        return "bottom-left"
    if neigh_water["bottom"] and neigh_water["right"]:
        return "bottom-right"
    if neigh_water["top"]:
        return "top"
    if neigh_water["bottom"]:
        return "bottom"
    if neigh_water["left"]:
        return "left"
    if neigh_water["right"]:
        return "right"
    return "center"

# ---------- IMPROVED BIOME BLENDING ------------------------------------------
def create_transition_map_scattered(material_grid,
                                    blend_width=DEFAULT_BLEND_WIDTH,
                                    blend_intensity=DEFAULT_BLEND_INTENSITY,
                                    scatter_intensity=DEFAULT_SCATTER_INTENSITY,
                                    seed=None):
    h, w = material_grid.shape
    rng = np.random.RandomState(seed)
    transition = np.zeros((h, w), dtype=np.float32)
    land = set(BIOME_COLORS.keys()) - {"water"}

    for y in range(h):
        for x in range(w):
            mat = material_grid[y, x]
            if mat == "water":
                continue

            # find neighboring land biomes
            neighbors = []
            for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
                nx, ny = x+dx, y+dy
                if 0 <= nx < w and 0 <= ny < h:
                    nmat = material_grid[ny, nx]
                    if nmat in land and nmat != mat:
                        neighbors.append(nmat)
            if not neighbors:
                continue

            # compute minimal distance up to blend_width
            min_dist = blend_width+1
            for dist in range(1, blend_width+1):
                if any(
                    0 <= x+dx*dist < w and 0 <= y+dy*dist < h and
                    material_grid[y+dy*dist, x+dx*dist] != mat
                    for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]
                ):
                    min_dist = dist
                    break
            if min_dist > blend_width:
                continue

            ratio = (min_dist / blend_width) * blend_intensity
            # apply jitter
            transition[y, x] = jitter_ratio(ratio, scatter_intensity, rng)
    return transition

def blend_colors(color1, color2, ratio):
    """Blend two RGB colors with a given ratio (0.0-1.0)."""
    r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
    g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
    b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
    return (r, g, b)

def create_transition_map(material_grid, blend_width=3, blend_intensity=0.7):
    """
    Create a transition map that identifies biome boundaries and calculates
    blend ratios for smooth transitions.
    """
    h, w = material_grid.shape
    transition_map = np.zeros((h, w, 3), dtype=np.float32)  # Store blend ratios per pixel
    
    # Create a set of land materials (exclude water)
    land_materials = set(BIOME_COLORS.keys()) - {"water"}
    
    for y in range(h):
        for x in range(w):
            current_mat = material_grid[y, x]
            
            # Skip water pixels
            if current_mat == "water":
                continue
            
            # Check neighbors for different biomes
            neighbor_biomes = set()
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:  # 4-directional neighbors
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    neighbor_mat = material_grid[ny, nx]
                    if neighbor_mat in land_materials and neighbor_mat != current_mat:
                        neighbor_biomes.add(neighbor_mat)
            
            # If we're on a biome boundary
            if neighbor_biomes:
                # Calculate distance to boundaries
                min_distance = float('inf')
                for biome in neighbor_biomes:
                    # Simple distance calculation - could be improved with proper distance transform
                    for dist in range(1, blend_width + 1):
                        found = False
                        for dx, dy in [(-dist, 0), (dist, 0), (0, -dist), (0, dist)]:
                            nx, ny = x + dx, y + dy
                            if 0 <= nx < w and 0 <= ny < h:
                                if material_grid[ny, nx] == biome:
                                    min_distance = min(min_distance, dist)
                                    found = True
                                    break
                        if found:
                            break
                
                if min_distance < blend_width:
                    # Calculate blend ratio based on distance
                    ratio = min(1.0, min_distance / blend_width) * blend_intensity
                    # Store the blend ratio for this pixel
                    transition_map[y, x] = [ratio, min_distance, len(neighbor_biomes)]
    
    return transition_map

def apply_biome_blending(tile_image, base_material, neighbor_materials, blend_ratio):
    """
    Apply biome blending to a tile by adjusting its colors based on adjacent biomes.
    Preserves tile structure while modifying colors.
    """
    if not neighbor_materials or blend_ratio <= 0.01:
        return tile_image  # No blending needed
    
    # Convert tile to RGB for color manipulation
    tile_rgb = tile_image.convert("RGB")
    base_color = BIOME_COLORS[base_material]
    
    # Calculate average neighbor color
    neighbor_colors = [BIOME_COLORS[mat] for mat in neighbor_materials]
    avg_neighbor_color = tuple(
        int(sum(c[i] for c in neighbor_colors) / len(neighbor_colors))
        for i in range(3)
    )
    
    # Create blended color
    blended_color = blend_colors(base_color, avg_neighbor_color, blend_ratio)
    
    # Adjust tile colors
    tile_data = np.array(tile_rgb)
    base_color_arr = np.array(base_color)
    
    # Calculate color difference
    color_diff = np.array(blended_color) - base_color_arr
    
    # Apply color adjustment based on pixel intensity
    for y in range(tile_data.shape[0]):
        for x in range(tile_data.shape[1]):
            pixel = tile_data[y, x]
            
            # Skip fully transparent pixels (if we had an alpha channel)
            # if tile_image.mode == 'RGBA' and tile_image.getpixel((x, y))[3] == 0:
            #    continue
            
            # Calculate intensity factor (darker areas blend less)
            intensity = sum(pixel) / (3 * 255)
            intensity_factor = 0.5 + intensity * 0.5  # 0.5-1.0 range
            
            # Apply adjusted color difference
            new_pixel = pixel + (color_diff * intensity_factor).astype(int)
            tile_data[y, x] = np.clip(new_pixel, 0, 255)
    
    # Convert back to Image and restore alpha channel
    blended_tile = Image.fromarray(tile_data, 'RGB')
    if tile_image.mode == 'RGBA':
        blended_tile.putalpha(tile_image.split()[3])
    
    return blended_tile

def generate_layer(map_path, use_water, blend_width, blend_intensity, scatter_intensity, seed):
    mask = Image.open(map_path).convert("RGBA")
    pix = np.array(mask)
    h, w, _ = pix.shape

    # Build material grid
    grid = np.empty((h, w), dtype=object)
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[y, x]
            if a < 127:
                grid[y, x] = "water"
            else:
                key = closest_palette_key((r, g, b), COLOR_TO_TYPE)
                grid[y, x] = COLOR_TO_TYPE[key]

    trans = create_transition_map_scattered(
        grid, blend_width, blend_intensity, scatter_intensity, seed
    )

    tiles = load_tileset(TILESET_DIR, alternate_version=not use_water)
    out = Image.new("RGBA", (w * TILE_SIZE, h * TILE_SIZE))
    water_tile = tiles[("water", None)]

    # Settings for optional tile scattering
    SCATTER_TILES = True
    SCATTER_PROBABILITY = 0.1

    if use_water:
        for y in range(h):
            for x in range(w):
                nx, ny = x * SCALE, y * SCALE
                noise_val = pnoise2(nx, ny, octaves=3, repeatx=1024, repeaty=1024, base=42)
                brightness_factor = BRIGHTNESS_MIN + (noise_val + 1) / 2 * (BRIGHTNESS_MAX - BRIGHTNESS_MIN)
                enhancer = ImageEnhance.Brightness(water_tile)
                bright_tile = enhancer.enhance(brightness_factor)
                out.paste(bright_tile, (x * TILE_SIZE, y * TILE_SIZE))

    overlay = {m: {"tl": tiles.get((m, "center_top_left")),
                   "br": tiles.get((m, "center_bottom_right"))}
               for m in ["grass", "sand", "stone"]}

    for y in range(h):
        for x in range(w):
            mat = grid[y, x]
            if mat == "water":
                continue

            ratio = trans[y, x]
            neigh_water = get_neighbors(pix, x, y, is_water, True)
            shape = classify_by_water(neigh_water)

            # Internal-corner overlays
            if shape == "center" and all(not neigh_water[c] for c in CARDINALS):
                diags = [d for d in DIAGONALS if neigh_water[d]]
                if len(diags) == 1:
                    corner = diags[0]
                    ov = overlay[mat]["tl"] if corner in ("top-left", "top-right") else overlay[mat]["br"]
                    if corner in ("top-right", "bottom-left") and ov:
                        ov = ImageOps.mirror(ov)
                    if ov:
                        out.paste(ov, (x * TILE_SIZE, y * TILE_SIZE), ov)
                        continue

            canon, flip = FLIP_MAP.get(shape, (shape, False))
            tile = tiles.get((mat, canon), tiles[(mat, "center")])
            if flip:
                tile = ImageOps.mirror(tile)

            # Biome blending or scattering
            if ratio > 0:
                nbs = {
                    grid[y + dy, x + dx]
                    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]
                    if 0 <= x + dx < w and 0 <= y + dy < h
                }
                nbs.discard(mat)
                nbs.discard("water")
                if nbs:
                    # NEW: random scattering
                    if SCATTER_TILES and rand.random() < SCATTER_PROBABILITY:
                        scatter_choice = rand.choice(list(nbs))
                        tile_alt = tiles.get((scatter_choice, canon), tiles.get((scatter_choice, "center")))
                        if tile_alt:
                            if flip:
                                tile_alt = ImageOps.mirror(tile_alt)
                            tile = tile_alt
                    else:
                        tile = apply_biome_blending(tile, mat, nbs, ratio)

            out.paste(tile, (x * TILE_SIZE, y * TILE_SIZE), tile)

    return out, h, w, grid


def add_street(final_img: Image.Image):
    road_layer = Image.open(MAP_ROADS).convert("RGBA")
    w, h = road_layer.size

    # Load road tiles
    tile_names = ["road_center", "road_left", "road_right", "road_top", "road_bottom"]
    road_tiles = {}
    for name in tile_names:
        path = Path(TILESET_DIR) / f"{name}.png"
        if path.exists():
            road_tiles[name] = Image.open(path).convert("RGBA")
        else:
            raise FileNotFoundError(f"Missing road tile: {name}.png")

    # Read alpha mask as boolean mask
    is_road = np.array(road_layer)[..., 3] > 127  # shape (h, w)

    for y in range(h):
        for x in range(w):
            if not is_road[y, x]:
                continue

            # Always place road_center
            base_tile = road_tiles["road_center"]
            dx, dy = base_tile.size
            offset_x = x * TILE_SIZE + (TILE_SIZE - dx) // 2
            offset_y = y * TILE_SIZE + (TILE_SIZE - dy)
            final_img.paste(base_tile, (offset_x, offset_y), base_tile)

            # Neighbor-aware overlays
            neighbors = {
                "road_left":   (x - 1, y),
                "road_right":  (x + 1, y),
                "road_top":    (x, y - 1),
                "road_bottom": (x, y + 1),
            }
            for tile_name, (nx, ny) in neighbors.items():
                if 0 <= nx < w and 0 <= ny < h and is_road[ny, nx]:
                    tile = road_tiles[tile_name]
                    dx, dy = tile.size
                    ox = x * TILE_SIZE + (TILE_SIZE - dx) // 2
                    oy = y * TILE_SIZE + (TILE_SIZE - dy)
                    final_img.paste(tile, (ox, oy), tile)

    print("🛣️ Streets added.")


def add_handdrawn_trees(final_img: Image.Image, grid_base: np.ndarray):
    tree_layer = Image.open(MAP_TREES).convert("RGBA")

    w, h = grid_base.shape[1], grid_base.shape[0]
    assert tree_layer.size == (w, h), "Tree layer must be 1px per tile"

    # Load tree sprites
    tree_sprites = []
    for i in range(12):
        path = Path(TILESET_DIR) / f"tree_{i}.png"
        if path.exists():
            tree_sprites.append(Image.open(path).convert("RGBA"))

    tree_sand = None
    sand_tree_path = Path(TILESET_DIR) / "tree_sand_0.png"
    if sand_tree_path.exists():
        tree_sand = Image.open(sand_tree_path).convert("RGBA")

    for y in range(h):
        for x in range(w):
            _, _, _, alpha = tree_layer.getpixel((x, y))
            if alpha <= 127:
                continue

            biome = grid_base[y, x]
            if biome == "sand" and tree_sand:
                tree = tree_sand
            elif tree_sprites:
                tree = rand.choice(tree_sprites)
            else:
                continue

            dx, dy = tree.size
            offset_x = x * TILE_SIZE + (TILE_SIZE - dx) // 2
            offset_y = y * TILE_SIZE + (TILE_SIZE - dy)
            final_img.paste(tree, (offset_x, offset_y), tree)

    print("🌳 Hand-drawn trees added.")


def generate_map(blend_width: int = DEFAULT_BLEND_WIDTH,
                 blend_intensity: float = DEFAULT_BLEND_INTENSITY,
                 scatter_intensity: float = DEFAULT_SCATTER_INTENSITY,
                 seed=None):
    # Load mask as RGBA
    base_layer, h, w, grid_base = generate_layer(MAP_PATH,   True,  blend_width, blend_intensity, scatter_intensity, seed)
    layer1,     _, _, grid1     = generate_layer(MAP_PATH_1, False, blend_width, blend_intensity, scatter_intensity, seed)
    layer2,     _, _, grid2     = generate_layer(MAP_PATH_2, False, blend_width, blend_intensity, scatter_intensity, seed)

    layer1 = ImageEnhance.Brightness(layer1).enhance(0.9)
    layer1 = ImageEnhance.Contrast(layer1).enhance(0.9)

    layer2 = ImageEnhance.Brightness(layer2).enhance(0.8)
    layer2 = ImageEnhance.Contrast(layer2).enhance(0.9)

    final = Image.new("RGBA", base_layer.size)
    # composite expects fully-opaque “background” first, so start with base
    final = Image.alpha_composite(final, base_layer)
    final = Image.alpha_composite(final, layer1)
    final = Image.alpha_composite(final, layer2)

    add_street(final)

    # base_layer.save("output_map.png")
    # layer1.save("output_map_layer1.png")
    # layer2.save("output_map_layer2.png")

    # Grass decorations
    decorations = {"grass": [], "stone": [], "sand": [], "water": []}
    decorations_probabilities = {"grass": 0.08, "sand": 0.01, "stone": 0.01, "water": 0.01}
    for base, count in [
        ("herbs_tile_", 43),
    ]:
        for i in range(count):
            name = f"{base}{i}.png" if base.endswith('_tile_') else f"{base}{i+1}.png"
            path = Path(TILESET_DIR) / name
            if path.exists():
                img = Image.open(path).convert("RGBA")
                decorations["grass"].append(img)
    
    for base, count in [
        ("beach_tile_", 18),
    ]:
        for i in range(count):
            name = f"{base}{i}.png"
            path = Path(TILESET_DIR) / name
            if path.exists():
                img = Image.open(path).convert("RGBA")
                decorations["sand"].append(img)
    
    for base, count in [
        ("stones_", 6),
    ]:
        for i in range(count):
            name = f"{base}{i}.png"
            path = Path(TILESET_DIR) / name
            if path.exists():
                img = Image.open(path).convert("RGBA")
                decorations["stone"].append(img)

    for base, count in [
        ("fish_", 10),
    ]:
        for i in range(count):
            name = f"{base}{i}.png"
            path = Path(TILESET_DIR) / name
            if path.exists():
                img = Image.open(path).convert("RGBA")
                decorations["water"].append(img)

    # Paste decorations on grass tiles with a small random chance
    for y in range(h):
        for x in range(w):

            available_decorations = decorations.get(grid_base[y,x])
            if len(available_decorations) == 0:
                continue
            if rand.random() > decorations_probabilities[grid_base[y,x]]:  # ~8% chance to decorate
                continue
            deco = rand.choice(available_decorations)
            dx, dy = deco.size
            if dy > 32 and rand.random() > 0.5:
                continue
            # Random offset so decoration is not always centered
            offset_x = x * TILE_SIZE + (TILE_SIZE - dx) // 2
            offset_y = y * TILE_SIZE + (TILE_SIZE - dy)
            final.paste(deco, (offset_x, offset_y), deco)

    add_handdrawn_trees(final, grid_base)


    # out_base.save(OUTPUT_PATH)
    final.save("merged_map_alpha_composite.png")

    print(f"✅ Saved scattered map to {OUTPUT_PATH}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate map with biome blending")
    parser.add_argument("--blend-width", type=int, default=DEFAULT_BLEND_WIDTH,
                        help="Width of biome transition zones (in pixels)")
    parser.add_argument("--blend-intensity", type=float, default=DEFAULT_BLEND_INTENSITY,
                        help="Intensity of biome blending (0.0-1.0)")
    parser.add_argument("--seed", type=int, default=DEFAULT_RNG_SEED,
                        help="RNG seed for deterministic blending (omit for random each run)")
    args = parser.parse_args()

    generate_map(
        blend_width=args.blend_width,
        blend_intensity=args.blend_intensity,
        seed=args.seed
    )
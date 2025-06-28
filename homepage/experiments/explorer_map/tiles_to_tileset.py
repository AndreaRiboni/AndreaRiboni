from PIL import Image

TILE_MAPPING = {
    ("water", None): "tile_20.png",
    ("grass", "center"): "tile_14.png",
    ("grass", "top"): "tile_1.png",
    ("grass", "left"): "tile_13.png",
    ("grass", "bottom"): "tile_27.png",
    ("grass", "bottom-right"): "tile_28.png",
    ("grass", "top-left"): "tile_0.png",
    ("grass", "center_top_left"): "intra_tile_top_left.png",
    ("grass", "center_bottom_right"): "intra_tile_bottom_right.png",
}

TILE_SIZE = 32
tiles = [Image.open(f"tiles/{fname}").convert("RGBA") for fname in TILE_MAPPING.values()]
sheet = Image.new("RGBA", (TILE_SIZE * len(tiles), TILE_SIZE))

for i, tile in enumerate(tiles):
    sheet.paste(tile, (i * TILE_SIZE, 0))

sheet.save("tileset.png")
print("tileset.png saved.")

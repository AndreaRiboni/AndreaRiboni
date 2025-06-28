from PIL import Image
import os

def slice_tileset(image_path: str, tile_size: int, output_dir: str = "tiles"):
    """
    Slice a tileset PNG into individual tiles.

    Args:
        image_path (str): Path to the tileset PNG.
        tile_size (int): Width and height of each square tile.
        output_dir (str): Folder where to save individual tiles.
    """
    os.makedirs(output_dir, exist_ok=True)

    image = Image.open(image_path)
    img_width, img_height = image.size

    tiles_x = img_width // tile_size
    tiles_y = img_height // tile_size

    tile_index = 0
    for y in range(tiles_y):
        for x in range(tiles_x):
            left = x * tile_size
            upper = y * tile_size
            right = left + tile_size
            lower = upper + tile_size

            tile = image.crop((left, upper, right, lower))
            tile_filename = os.path.join(output_dir, f"fish_{tile_index}.png")
            tile.save(tile_filename)
            tile_index += 1

    print(f"Saved {tile_index} tiles to '{output_dir}'.")

# Example usage:
slice_tileset("C:\\Users\\Andrea\\Downloads\\fish.png", 16)

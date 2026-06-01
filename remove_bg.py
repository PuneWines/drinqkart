from PIL import Image

def remove_black_background(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    
    pixels = img.load()
    width, height = img.size
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # If color is close to black
            if r < 20 and g < 20 and b < 20:
                # Calculate alpha based on how close to black it is to avoid jagged edges
                intensity = max(r, g, b)
                alpha = int((intensity / 20.0) * 255)
                pixels[x, y] = (r, g, b, alpha)

    img.save(output_path, "PNG")

remove_black_background(
    r"C:\Users\iqra tabassum\.gemini\antigravity-ide\brain\1f9e6f6e-9233-4cee-8900-c1e6ab098cc6\media__1780143179989.png",
    r"c:\Users\iqra tabassum\OneDrive\Desktop\frontend\public\logo.png"
)

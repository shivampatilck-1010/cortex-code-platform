import numpy as np
from PIL import Image
import os

def process_logo():
    src_path = 'public/brand/cortex-logo.jpg'
    if not os.path.exists(src_path):
        print("Source not found:", src_path)
        return

    img = Image.open(src_path).convert('RGB')
    arr = np.array(img, dtype=float)
    h, w, _ = arr.shape

    # Background estimation (gradient from top ~251 to bottom ~235)
    bg_top = np.array([251.0, 251.0, 249.0])
    bg_bottom = np.array([235.0, 235.0, 235.0])
    y_factors = np.linspace(0, 1, h)[:, None, None]
    bg_est = np.tile(bg_top * (1 - y_factors) + bg_bottom * y_factors, (1, w, 1))

    # Foreground distance metric
    diff = np.linalg.norm(arr - bg_est, axis=2)
    max_c = np.max(arr, axis=2)
    min_c = np.min(arr, axis=2)
    chroma = max_c - min_c

    # Saturated orange and dark charcoal detection
    # Increase threshold to ignore faint drop shadows on white background
    fg_score = np.maximum(diff, chroma * 1.8)

    # Clean alpha ramp (cut off drop shadow below 22)
    alpha = np.clip((fg_score - 22.0) / (45.0 - 22.0), 0.0, 1.0)
    alpha = np.power(alpha, 1.2) * 255.0

    # Create full transparent logo
    norm_alpha = (alpha / 255.0)[:, :, None]
    safe_alpha = np.maximum(norm_alpha, 0.08)
    unblended = np.clip((arr - bg_est * (1 - safe_alpha)) / safe_alpha, 0, 255)
    full_rgba = np.dstack((unblended.astype(np.uint8), alpha.astype(np.uint8)))
    full_img = Image.fromarray(full_rgba, mode='RGBA')
    full_img.save('public/brand/cortex-logo-transparent.png')
    print("Saved public/brand/cortex-logo-transparent.png")

    # Crop Emblem (C1 with code brackets)
    # Bounding box strictly ending before wordmark (gap is 595-605)
    emblem_crop = full_img.crop((150, 150, 860, 590))
    
    # Trim transparent borders
    bbox = emblem_crop.getbbox()
    if bbox:
        emblem_tight = emblem_crop.crop(bbox)
    else:
        emblem_tight = emblem_crop

    # Make square with padding
    ew, eh = emblem_tight.size
    max_side = max(ew, eh)
    pad = int(max_side * 0.05)
    square_size = max_side + 2 * pad
    square_emblem = Image.new('RGBA', (square_size, square_size), (0, 0, 0, 0))
    offset = ((square_size - ew) // 2, (square_size - eh) // 2)
    square_emblem.paste(emblem_tight, offset)

    # Save high-res emblem
    square_emblem.save('public/brand/cortex-emblem.png')
    print("Saved public/brand/cortex-emblem.png:", square_emblem.size)

    # Generate multi-size app icons
    for size in [32, 48, 64, 96, 128, 192, 256, 512]:
        resized = square_emblem.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(f'public/brand/cortex-icon-{size}.png')

    # Copy 192 and 512 to root public
    square_emblem.resize((192, 192), Image.Resampling.LANCZOS).save('public/logo192.png')
    square_emblem.resize((512, 512), Image.Resampling.LANCZOS).save('public/logo512.png')
    square_emblem.resize((48, 48), Image.Resampling.LANCZOS).save('public/favicon.ico')
    square_emblem.resize((180, 180), Image.Resampling.LANCZOS).save('public/apple-touch-icon.png')
    print("Saved favicons and app icons.")

if __name__ == '__main__':
    process_logo()

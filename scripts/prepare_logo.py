#!/usr/bin/env python3
"""
Logo Preparation Script
Converts a source logo image to the required sizes and formats for the frontend.
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: PIL (Pillow) is required. Install it with:")
    print("  pip install Pillow")
    sys.exit(1)


def create_favicon(source_image, output_path, size=32):
    """Create favicon.ico from source image."""
    img = source_image.resize((size, size), Image.Resampling.LANCZOS)
    # Convert to RGBA if needed
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Save as ICO
    img.save(output_path, format='ICO', sizes=[(size, size)])
    print(f"✓ Created {output_path} ({size}x{size})")


def prepare_logos(source_path, output_dir):
    """Prepare all logo files from source image."""
    # Check if source file exists
    if not os.path.exists(source_path):
        print(f"Error: Source file not found: {source_path}")
        print("\nUsage:")
        print("  python scripts/prepare_logo.py <path-to-your-logo-image>")
        print("\nExample:")
        print("  python scripts/prepare_logo.py ~/Downloads/my-logo.png")
        sys.exit(1)
    
    # Load source image
    try:
        source_img = Image.open(source_path)
        print(f"✓ Loaded source image: {source_path}")
        print(f"  Original size: {source_img.size[0]}x{source_img.size[1]}")
        print(f"  Format: {source_img.format}")
    except Exception as e:
        print(f"Error: Could not open image: {e}")
        sys.exit(1)
    
    # Ensure output directory exists
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Convert to RGBA if needed (for transparency support)
    if source_img.mode != 'RGBA':
        print("  Converting to RGBA for transparency support...")
        source_img = source_img.convert('RGBA')
    
    # Create logo192.png (192x192)
    logo192_path = output_dir / "logo192.png"
    logo192 = source_img.resize((192, 192), Image.Resampling.LANCZOS)
    logo192.save(logo192_path, format='PNG', optimize=True)
    print(f"✓ Created {logo192_path} (192x192)")
    
    # Create logo512.png (512x512)
    logo512_path = output_dir / "logo512.png"
    logo512 = source_img.resize((512, 512), Image.Resampling.LANCZOS)
    logo512.save(logo512_path, format='PNG', optimize=True)
    print(f"✓ Created {logo512_path} (512x512)")
    
    # Create favicon.ico (32x32)
    favicon_path = output_dir / "favicon.ico"
    create_favicon(source_img, favicon_path, size=32)
    
    # Also create PNG versions for better browser support
    favicon32_png = output_dir / "favicon32.png"
    favicon32_img = source_img.resize((32, 32), Image.Resampling.LANCZOS)
    favicon32_img.save(favicon32_png, format='PNG', optimize=True)
    print(f"✓ Created {favicon32_png} (32x32)")
    
    favicon16_png = output_dir / "favicon16.png"
    favicon16_img = source_img.resize((16, 16), Image.Resampling.LANCZOS)
    favicon16_img.save(favicon16_png, format='PNG', optimize=True)
    print(f"✓ Created {favicon16_png} (16x16)")
    
    # Also create a 16x16 ICO version
    favicon16_path = output_dir / "favicon16.ico"
    create_favicon(source_img, favicon16_path, size=16)
    
    print("\n" + "="*60)
    print("Logo preparation complete!")
    print("="*60)
    print(f"\nFiles created in: {output_dir}")
    print("  - logo192.png (192x192)")
    print("  - logo512.png (512x512)")
    print("  - favicon.ico (32x32)")
    print("  - favicon32.png (32x32)")
    print("  - favicon16.png (16x16)")
    print("  - favicon16.ico (16x16)")
    print("\nNext steps:")
    print("  1. Review the generated files")
    print("  2. Copy them to frontend/public/ if needed:")
    print(f"     cp {output_dir}/logo*.png frontend/public/")
    print(f"     cp {output_dir}/favicon.ico frontend/public/")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Logo Preparation Script")
        print("="*60)
        print("\nUsage:")
        print("  python scripts/prepare_logo.py <path-to-your-logo-image>")
        print("\nExample:")
        print("  python scripts/prepare_logo.py ~/Downloads/my-logo.png")
        print("  python scripts/prepare_logo.py logo.png")
        print("\nSupported formats: PNG, JPG, JPEG, SVG, ICO, BMP, GIF")
        print("\nThe script will create:")
        print("  - logo192.png (192x192)")
        print("  - logo512.png (512x512)")
        print("  - favicon.ico (32x32)")
        sys.exit(1)
    
    source_path = sys.argv[1]
    output_dir = Path("frontend/public")
    
    prepare_logos(source_path, output_dir)


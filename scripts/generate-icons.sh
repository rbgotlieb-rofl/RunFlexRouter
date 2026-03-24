#!/bin/bash
# Generate iOS app icon set from a 1024x1024 source image.
# Usage: ./scripts/generate-icons.sh path/to/icon-1024.png
#
# Requires: ImageMagick (convert)
# Output goes to ios/App/App/Assets.xcassets/AppIcon.appiconset/

set -e

SRC="${1:?Usage: $0 <source-1024x1024.png>}"
OUT="ios/App/App/Assets.xcassets/AppIcon.appiconset"

mkdir -p "$OUT"

# All required sizes for iOS (points × scale)
declare -A SIZES=(
  ["icon-20@2x"]=40
  ["icon-20@3x"]=60
  ["icon-29@2x"]=58
  ["icon-29@3x"]=87
  ["icon-40@2x"]=80
  ["icon-40@3x"]=120
  ["icon-60@2x"]=120
  ["icon-60@3x"]=180
  ["icon-76@2x"]=152
  ["icon-83.5@2x"]=167
  ["icon-1024"]=1024
)

for name in "${!SIZES[@]}"; do
  size=${SIZES[$name]}
  echo "Generating ${name}.png (${size}x${size})"
  convert "$SRC" -resize "${size}x${size}" "$OUT/${name}.png"
done

# Contents.json for Xcode
cat > "$OUT/Contents.json" << 'ICONJSON'
{
  "images": [
    { "size": "20x20", "idiom": "iphone", "filename": "icon-20@2x.png", "scale": "2x" },
    { "size": "20x20", "idiom": "iphone", "filename": "icon-20@3x.png", "scale": "3x" },
    { "size": "29x29", "idiom": "iphone", "filename": "icon-29@2x.png", "scale": "2x" },
    { "size": "29x29", "idiom": "iphone", "filename": "icon-29@3x.png", "scale": "3x" },
    { "size": "40x40", "idiom": "iphone", "filename": "icon-40@2x.png", "scale": "2x" },
    { "size": "40x40", "idiom": "iphone", "filename": "icon-40@3x.png", "scale": "3x" },
    { "size": "60x60", "idiom": "iphone", "filename": "icon-60@2x.png", "scale": "2x" },
    { "size": "60x60", "idiom": "iphone", "filename": "icon-60@3x.png", "scale": "3x" },
    { "size": "76x76", "idiom": "ipad", "filename": "icon-76@2x.png", "scale": "2x" },
    { "size": "83.5x83.5", "idiom": "ipad", "filename": "icon-83.5@2x.png", "scale": "2x" },
    { "size": "1024x1024", "idiom": "ios-marketing", "filename": "icon-1024.png", "scale": "1x" }
  ],
  "info": { "version": 1, "author": "xcode" }
}
ICONJSON

echo "Done! Icons generated in $OUT"
echo "Note: You still need to provide a 1024x1024 source PNG."

import sharp from "sharp";

export const processImageByShape = async (inputPath, shape, width, height) => {
  const outputPath = `${inputPath}-processed.png`;
  const sharpInstance = sharp(inputPath);

  // Resize to match the requested dimensions
  sharpInstance.resize(width, height, { fit: "cover" });

  // Create a mask buffer based on shape
  let maskBuffer;

  switch (shape) {
    case "circle": {
      // Create a circular mask
      const radius = Math.min(width, height) / 2;
      const centerX = width / 2;
      const centerY = height / 2;

      maskBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
                <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="white"/>
              </svg>`
            ),
            blend: "over",
          },
        ])
        .png()
        .toBuffer();
      break;
    }

    case "hexagon": {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2;

      let points = "";
      for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6 - Math.PI / 6;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        points += `${x},${y} `;
      }

      maskBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
                <polygon points="${points}" fill="white"/>
              </svg>`
            ),
            blend: "over",
          },
        ])
        .png()
        .toBuffer();
      break;
    }

    case "triangle": {
      maskBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
                <polygon points="${
                  width / 2
                },0 ${width},${height} 0,${height}" fill="white"/>
              </svg>`
            ),
            blend: "over",
          },
        ])
        .png()
        .toBuffer();
      break;
    }

    default: {
      // Rectangle is default
      maskBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}">
                <rect width="${width}" height="${height}" fill="white"/>
              </svg>`
            ),
            blend: "over",
          },
        ])
        .png()
        .toBuffer();
    }
  }

  // Apply the mask to the image
  await sharpInstance
    .composite([{ input: maskBuffer, blend: "dest-in" }])
    .toFile(outputPath);

  return outputPath;
};

import fs from "node:fs/promises";
import sharp from "sharp";

await fs.mkdir("assets", { recursive: true });

const icon = await sharp("frontend/assets/icon.svg")
  .resize(1024, 1024)
  .png()
  .toBuffer();

await fs.writeFile("assets/icon-only.png", icon);

const splashIcon = await sharp(icon).resize(720, 720).png().toBuffer();

await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: "#0a0d12",
  },
})
  .composite([{ input: splashIcon, gravity: "center" }])
  .png()
  .toFile("assets/splash.png");

console.log("assets/icon-only.png e assets/splash.png gerados.");

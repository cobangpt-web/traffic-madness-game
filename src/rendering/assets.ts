import type { CarColor } from "../game/types";

export const IMAGE_PATHS = {
  ambulance: "/assets/racing/ambulance.png",
  arrow: "/assets/racing/arrow_white.png",
  barrier: "/assets/racing/barrier_white_race.png",
  blackCar: "/assets/racing/car_black_1.png",
  blueCar: "/assets/racing/car_blue_1.png",
  cone: "/assets/racing/cone_straight.png",
  grass: "/assets/racing/land_grass11.png",
  greenCar: "/assets/racing/car_green_1.png",
  redCar: "/assets/racing/car_red_1.png",
  rock1: "/assets/racing/rock1.png",
  rock2: "/assets/racing/rock2.png",
  skidmark: "/assets/racing/skidmark_short_1.png",
  treeLarge: "/assets/racing/tree_large.png",
  treeSmall: "/assets/racing/tree_small.png",
  yellowCar: "/assets/racing/car_yellow_1.png",
} as const;

export type ImageKey = keyof typeof IMAGE_PATHS;
export type ImageAssets = Readonly<Partial<Record<ImageKey, HTMLImageElement>>>;

export const CAR_IMAGE_KEYS: Readonly<Record<CarColor, ImageKey>> = {
  RED: "redCar",
  BLUE: "blueCar",
  GREEN: "greenCar",
  YELLOW: "yellowCar",
  BLACK: "blackCar",
};

export interface LoadedAssets {
  readonly images: ImageAssets;
  readonly failures: readonly string[];
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${source}`));
    image.src = source;
  });
}

export async function loadGameAssets(): Promise<LoadedAssets> {
  const entries = Object.entries(IMAGE_PATHS) as [ImageKey, string][];
  const images: Partial<Record<ImageKey, HTMLImageElement>> = {};
  const failures: string[] = [];

  await Promise.all(
    entries.map(async ([key, source]) => {
      try {
        images[key] = await loadImage(source);
      } catch {
        failures.push(source);
      }
    }),
  );

  return { images, failures };
}

import * as THREE from "three";
import materialAtlasUrl from "../assets/harbor-materials.webp";
import buildingAtlasUrl from "../assets/harbor-buildings.webp";

/** Original image-generated art, bundled by Vite for the website and offline game. */
export const MATERIAL_ATLAS_URL = materialAtlasUrl;
export const BUILDING_ATLAS_URL = buildingAtlasUrl;
export type BuildingAtlasCell = {
  column: number;
  row: number;
  columns: 3;
  rows: 2;
};
export const BUILDING_ART: Record<string, BuildingAtlasCell | undefined> = {
  cutter: { column: 0, row: 0, columns: 3, rows: 2 },
  forge: { column: 1, row: 0, columns: 3, rows: 2 },
  kitchen: { column: 2, row: 0, columns: 3, rows: 2 },
  boatyard: { column: 0, row: 1, columns: 3, rows: 2 },
  kelpfarm: { column: 1, row: 1, columns: 3, rows: 2 },
  warehouse: { column: 2, row: 1, columns: 3, rows: 2 },
};

export interface GeneratedMaterials {
  tunaSkin: THREE.MeshStandardMaterial;
  steakFace: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  /** False means the visible solid-color fallback was used instead of the image. */
  ready: Promise<boolean>;
  dispose: () => void;
}

/**
 * A private set per world prevents StrictMode/unmount from disposing another
 * world's textures. Materials share one GPU atlas; UV sampling stays inside the
 * selected quadrant, so tiling timber never leaks into the neighboring metal.
 * Assign these materials directly: Three's Material.clone does not copy hooks.
 */
export function createGeneratedMaterials(): GeneratedMaterials {
  const materials: THREE.MeshStandardMaterial[] = [];
  let disposed = false;
  let settle!: (loaded: boolean) => void;
  const ready = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const atlas = new THREE.TextureLoader().load(
    MATERIAL_ATLAS_URL,
    () => {
      if (disposed) {
        settle(false);
        return;
      }
      for (const material of materials) {
        material.color.set("#ffffff");
        material.userData.generatedArtLoaded = true;
        material.needsUpdate = true;
      }
      settle(true);
    },
    undefined,
    () => {
      if (!disposed) {
        // Keep the game usable and clearly colored if an asset cannot be read.
        for (const material of materials) {
          material.map = null;
          material.userData.generatedArtLoaded = false;
          material.needsUpdate = true;
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("harbor-art-error", {
              detail: {
                message:
                  "Harbor textures could not load. Using the fallback materials.",
              },
            }),
          );
        }
      }
      settle(false);
    },
  );
  atlas.name = "image-generated-harbor-material-atlas";
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
  // Mipmaps keep fine timber grain stable as the camera moves. Explicit UV
  // derivatives below avoid a false high LOD at each fract() tile boundary.
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.generateMipmaps = true;
  atlas.anisotropy = 8;

  function material(
    name: string,
    column: number,
    row: number,
    repeats: [number, number],
    fallback: string,
    metalness: number,
    roughness: number,
  ) {
    const result = new THREE.MeshStandardMaterial({
      name,
      map: atlas,
      color: fallback,
      metalness,
      roughness,
    });
    const offsetX = column * 0.5;
    const offsetY = (1 - row) * 0.5;
    const repeatX = repeats[0].toFixed(4),
      repeatY = repeats[1].toFixed(4);
    result.userData.generatedAtlas = "harbor-materials";
    result.userData.atlasCell = { column, row, columns: 2, rows: 2 };
    result.userData.generatedArtLoaded = false;
    result.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
#ifdef USE_MAP
  vec2 harborTileUv = fract(vMapUv * vec2(${repeatX}, ${repeatY}));
  vec2 harborAtlasUv = vec2(${(offsetX + 0.0015).toFixed(4)}, ${(offsetY + 0.0015).toFixed(4)}) + harborTileUv * 0.497;
  vec2 harborDx = dFdx(vMapUv * vec2(${repeatX}, ${repeatY})) * 0.497;
  vec2 harborDy = dFdy(vMapUv * vec2(${repeatX}, ${repeatY})) * 0.497;
  vec4 sampledDiffuseColor = textureGrad(map, harborAtlasUv, harborDx, harborDy);
  diffuseColor *= sampledDiffuseColor;
#endif
`,
      );
    };
    result.customProgramCacheKey = () =>
      `harbor-atlas:${column}:${row}:${repeatX}:${repeatY}`;
    materials.push(result);
    return result;
  }

  const tunaSkin = material(
    "generated-tuna-skin",
    0,
    0,
    [1, 1],
    "#5487a9",
    0.18,
    0.34,
  );
  const steakFace = material(
    "generated-tuna-cross-section",
    1,
    0,
    [1, 1],
    "#c84d58",
    0.02,
    0.48,
  );
  const wood = material(
    "generated-weathered-timber",
    0,
    1,
    [1, 1],
    "#b9885c",
    0,
    0.88,
  );
  const metal = material(
    "generated-frosted-steel",
    1,
    1,
    [2, 2],
    "#8fabb5",
    0.42,
    0.5,
  );

  return {
    tunaSkin,
    steakFace,
    wood,
    metal,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of materials) material.dispose();
      atlas.dispose();
      settle(false);
    },
  };
}

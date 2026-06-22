const DEMO_3D_ASSET_BASE =
  "https://storage.googleapis.com/test-deploy-august25/demo-3d";

export function demo3dAssetUrl(path: string): string {
  const clean = path
    .trim()
    .replace(/^https?:\/\/[^/]+\/demo-3d\//, "")
    .replace(/^\/?demo-3d\//, "")
    .replace(/^\/+/, "");
  return `${DEMO_3D_ASSET_BASE}/${clean}`;
}

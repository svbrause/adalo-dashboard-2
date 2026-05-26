import type { FaceLandmarker } from "@mediapipe/tasks-vision";

/** Keep in sync with `package.json` dependency for WASM layout compatibility. */
const MEDIAPIPE_TASKS_VISION_VERSION = "0.10.21";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;
const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const MEDIAPIPE_LOG_FILTER_PATTERNS = [
  "face_landmarker_graph.cc",
  "gl_context.cc",
  "inference_feedback_manager.cc",
  "Sets FaceBlendshapesGraph acceleration to xnnpack",
  "Graph successfully started running",
  "Created TensorFlow Lite XNNPACK delegate",
  "Feedback manager requires a model with a single signature inference",
];

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;
let mediaPipeLogFilterInstalled = false;

function installMediaPipeLogFilter() {
  if (!import.meta.env.DEV || mediaPipeLogFilterInstalled) return;
  mediaPipeLogFilterInstalled = true;

  const shouldHideMediaPipeLog = (args: unknown[]) =>
    args.some((arg) => {
      const message = typeof arg === "string" ? arg : "";
      return MEDIAPIPE_LOG_FILTER_PATTERNS.some((pattern) =>
        message.includes(pattern),
      );
    });

  const levels: Array<"debug" | "error" | "info" | "log" | "warn"> = [
    "debug",
    "error",
    "info",
    "log",
    "warn",
  ];

  levels.forEach((level) => {
    const original = console[level].bind(console) as (...args: unknown[]) => void;
    console[level] = ((...args: unknown[]) => {
      if (shouldHideMediaPipeLog(args)) return;
      original(...args);
    }) as Console[typeof level];
  });
}

export function getFaceLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      installMediaPipeLogFilter();
      const { FaceLandmarker, FilesetResolver } =
        await import("@mediapipe/tasks-vision");
      const wasm = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceLandmarker.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    })();
  }
  return faceLandmarkerPromise;
}

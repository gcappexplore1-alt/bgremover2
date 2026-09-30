/**
 * Background-removal worker.
 *
 * This is the app's segmentation worker: it runs an ONNX segmentation model with transformers.js /
 * ONNX Runtime Web (WebGPU when available, otherwise WebAssembly). Images never leave the device.
 *
 * The worker body below is the code of the original `seg.worker.ts` (module worker referenced with
 * `new Worker(new URL("../workers/seg.worker.ts", import.meta.url))`). It is kept in a string and started
 * from a Blob URL so this app can ship as ONE self-contained HTML file: a Vite-bundled worker would be a
 * separate asset file that a single-file deployment cannot serve, and inlining transformers.js + ONNX
 * Runtime would add tens of megabytes to the page. The logic is unchanged.
 *
 * `LIB_URL` is the prebuilt transformers.js bundle on jsDelivr (the package's own "jsdelivr" entry:
 * dist/transformers.min.js). Model weights still come from Hugging Face (or VITE_MODEL_HOST) as before.
 * To run fully self-hosted, point TRANSFORMERS_URL at your own copy.
 */
const TRANSFORMERS_VERSION = "4.3.0";
const TRANSFORMERS_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}`;

const WORKER_BODY = `
let tf = null;
let device = null;
const runners = new Map();

async function lib() {
  if (!tf) {
    tf = await import(LIB_URL);
    tf.env.allowLocalModels = false;
    tf.env.useBrowserCache = true;
  }
  return tf;
}

let gpuStorageBuffers = 0;

async function pickDevice() {
  if (device) return device;
  try {
    const gpu = self.navigator && self.navigator.gpu;
    const adapter = gpu ? await gpu.requestAdapter() : null;
    if (adapter) gpuStorageBuffers = (adapter.limits && adapter.limits.maxStorageBuffersPerShaderStage) || 8;
    device = adapter ? "webgpu" : "wasm";
  } catch (e) {
    device = "wasm";
  }
  return device;
}

const BIREFNET_SIZE = 1024;
const BIREFNET_MEAN = [0.485, 0.456, 0.406];
const BIREFNET_STD = [0.229, 0.224, 0.225];

function sigmoid(v) {
  return 1 / (1 + Math.exp(-v));
}

// BiRefNet-lite (WebGPU-rewritten export): resize to 1024x1024, ImageNet-normalise, emits logits -> sigmoid.
async function loadBirefnet(modelId, dev, progress_callback) {
  const T = await lib();
  const model = await T.AutoModel.from_pretrained(modelId, {
    config: { model_type: "custom" },
    device: dev,
    dtype: "fp32", // file is already fp16; this stops the library appending a dtype suffix
    model_file_name: "model_fp16",
    progress_callback: progress_callback,
  });
  return async function (img) {
    const S = BIREFNET_SIZE;
    const r = await img.resize(S, S);
    const px = new Float32Array(3 * S * S);
    for (let i = 0; i < S * S; i++)
      for (let c = 0; c < 3; c++) px[c * S * S + i] = (r.data[i * 3 + c] / 255 - BIREFNET_MEAN[c]) / BIREFNET_STD[c];
    let out;
    try {
      out = await model({ input_image: new T.Tensor("float32", px, [1, 3, S, S]) });
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (/float16|data ?type|tensor type/i.test(msg) && typeof Float16Array !== "undefined") {
        out = await model({ input_image: new T.Tensor("float16", Float16Array.from(px), [1, 3, S, S]) });
      } else throw e;
    }
    const outs = Object.values(out);
    let o = outs[outs.length - 1];
    for (const t of outs) {
      const d = t.dims || [];
      if (d[d.length - 1] === S && d[d.length - 2] === S) o = t;
    }
    const d = o.data;
    const m8 = new Uint8ClampedArray(S * S);
    for (let i = 0; i < S * S; i++) m8[i] = sigmoid(Number(d[i])) * 255;
    const mask = await new T.RawImage(m8, S, S, 1).resize(img.width, img.height);
    return new Uint8Array(mask.data);
  };
}

const ISNET_SIZE = 1024;

// IS-Net: stretch to 1024x1024, RGB/255 - 0.5, min-max normalise output, bilinear-resize back to image size.
async function loadIsnet(modelId, dev, progress_callback) {
  const T = await lib();
  const model = await T.AutoModel.from_pretrained(modelId, {
    config: { model_type: "custom" },
    dtype: "fp32",
    device: dev,
    progress_callback: progress_callback,
  });
  return async function (img) {
    const S = ISNET_SIZE;
    const r = await img.resize(S, S);
    const px = new Float32Array(3 * S * S);
    for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) px[c * S * S + i] = r.data[i * 3 + c] / 255 - 0.5;
    const out = await model({ input_image: new T.Tensor("float32", px, [1, 3, S, S]) });
    const o = out.output_image || Object.values(out)[0];
    const d = o.data;
    let mi = Infinity;
    let ma = -Infinity;
    for (let i = 0; i < S * S; i++) {
      const v = d[i];
      if (v < mi) mi = v;
      if (v > ma) ma = v;
    }
    const m8 = new Uint8ClampedArray(S * S);
    const k = ma - mi || 1;
    for (let i = 0; i < S * S; i++) m8[i] = ((d[i] - mi) / k) * 255;
    const mask = await new T.RawImage(m8, S, S, 1).resize(img.width, img.height);
    return new Uint8Array(mask.data);
  };
}

// A usable matte has a clear subject and a clear background. Degenerate output (almost all
// foreground, almost all background, or mostly half-transparent mush) means the precision or
// backend failed, not that the photo is hard.
function maskLooksBroken(mask) {
  let fg = 0, bg = 0, mid = 0;
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i];
    if (a > 239) fg++;
    else if (a < 16) bg++;
    else mid++;
  }
  const n = mask.length || 1;
  return fg / n < 0.005 || bg / n < 0.005 || mid / n > 0.5;
}

async function loadPipeline(modelId, dev, progress_callback) {
  const T = await lib();
  const isModnet = modelId.includes("modnet");
  // MODNet's fp16 export produces noisy, partially inverted mattes on WebGPU (the model is tiny,
  // so full precision costs little). q8 was the configuration verified in Node on WASM.
  const dtype = isModnet ? (dev === "webgpu" ? "fp32" : "q8") : dev === "webgpu" ? "fp16" : "fp32";
  const build = async function (d, dt) {
    const pipe = await T.pipeline("background-removal", modelId, { device: d, dtype: dt, progress_callback: progress_callback });
    return async function (img) {
      const out = await pipe(img);
      const res = Array.isArray(out) ? out[0] : out;
      if (!res || res.channels !== 4 || res.width !== img.width || res.height !== img.height) throw new Error("The model returned an unexpected mask shape.");
      const mask = new Uint8Array(img.width * img.height);
      for (let i = 0; i < mask.length; i++) mask[i] = res.data[i * 4 + 3];
      return mask;
    };
  };
  const primary = await build(dev, dtype);
  let fallback = null;
  return async function (img) {
    const mask = await primary(img);
    if (!maskLooksBroken(mask)) return mask;
    // Precision/backend failure: retry once at full precision on the CPU path.
    if (!fallback) fallback = await build("wasm", isModnet ? "q8" : "fp32");
    const again = await fallback(img);
    return maskLooksBroken(again) ? mask : again;
  };
}

async function getRunner(m) {
  const T = await lib();
  if (m.host) T.env.remoteHost = m.host;
  if (!runners.has(m.modelId)) {
    const p = (async function () {
      const dev = await pickDevice();
      if (m.webgpuOnly && (dev !== "webgpu" || gpuStorageBuffers < 8))
        throw new Error("Fine detail isn’t available in this browser. Choose Standard instead.");
      const progress_callback = function (p) {
        if (p && p.status === "progress" && p.total) self.postMessage({ type: "progress", id: m.id, file: p.file, loaded: p.loaded, total: p.total });
      };
      const load = function (d) {
        if (m.kind === "isnet") return loadIsnet(m.modelId, d, progress_callback);
        if (m.kind === "birefnet") return loadBirefnet(m.modelId, d, progress_callback);
        return loadPipeline(m.modelId, d, progress_callback);
      };
      self.postMessage({ type: "stage", id: m.id, stage: "model", device: dev });
      try {
        return await load(dev);
      } catch (e) {
        if (dev !== "webgpu" || m.webgpuOnly) throw e;
        device = "wasm";
        self.postMessage({ type: "stage", id: m.id, stage: "model", device: "wasm" });
        return await load("wasm");
      }
    })();
    p.catch(function () {
      runners.delete(m.modelId);
    });
    runners.set(m.modelId, p);
  }
  return runners.get(m.modelId);
}

self.onmessage = async function (e) {
  const m = e.data;
  try {
    const run = await getRunner(m);
    if (m.type === "warmup") {
      self.postMessage({ type: "ready", id: m.id });
      return;
    }
    const T = await lib();
    self.postMessage({ type: "stage", id: m.id, stage: "inference", device: device });
    const mask = await run(new T.RawImage(new Uint8ClampedArray(m.rgb), m.width, m.height, 3));
    self.postMessage({ type: "done", id: m.id, mask: mask.buffer, device: device }, [mask.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", id: m.id, error: err instanceof Error ? err.message : String(err) });
  }
};
`;

let blobUrl: string | null = null;

/** Create a fresh segmentation worker (the Blob URL is reused after a worker is terminated). */
export function createSegWorker(): Worker {
  if (!blobUrl) {
    const source = `const LIB_URL = ${JSON.stringify(TRANSFORMERS_URL)};\n${WORKER_BODY}`;
    blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  }
  return new Worker(blobUrl, { type: "module" });
}

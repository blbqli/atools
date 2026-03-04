export type ImageExportFormat = "jpg" | "png" | "webp" | "bmp" | "ico" | "gif";

type ImageExportConfig = {
  extension: string;
  label: string;
  mimeType: string;
  supportsQuality: boolean;
};

const IMAGE_EXPORT_CONFIG: Record<ImageExportFormat, ImageExportConfig> = {
  jpg: { extension: "jpg", label: "JPG", mimeType: "image/jpeg", supportsQuality: true },
  png: { extension: "png", label: "PNG", mimeType: "image/png", supportsQuality: false },
  webp: { extension: "webp", label: "WebP", mimeType: "image/webp", supportsQuality: true },
  bmp: { extension: "bmp", label: "BMP", mimeType: "image/bmp", supportsQuality: false },
  ico: { extension: "ico", label: "ICO", mimeType: "image/x-icon", supportsQuality: false },
  gif: { extension: "gif", label: "GIF", mimeType: "image/gif", supportsQuality: false },
};

export const IMAGE_EXPORT_FORMATS: ImageExportFormat[] = ["jpg", "png", "webp", "bmp", "ico", "gif"];

const DEFAULT_LOSSY_QUALITY = 0.92;

export const getImageExportLabel = (format: ImageExportFormat): string => IMAGE_EXPORT_CONFIG[format].label;

export const getImageExportExtension = (format: ImageExportFormat): string => IMAGE_EXPORT_CONFIG[format].extension;

export const getImageExportMimeType = (format: ImageExportFormat): string => IMAGE_EXPORT_CONFIG[format].mimeType;

const createWhiteBackgroundCanvas = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const outputCtx = output.getContext("2d");
  if (!outputCtx) return source;
  outputCtx.fillStyle = "#ffffff";
  outputCtx.fillRect(0, 0, output.width, output.height);
  outputCtx.drawImage(source, 0, 0);
  return output;
};

export const exportCanvasToImageBlob = (
  canvas: HTMLCanvasElement,
  format: ImageExportFormat,
  quality?: number,
): Promise<Blob> => {
  const config = IMAGE_EXPORT_CONFIG[format];
  const exportCanvas = format === "jpg" ? createWhiteBackgroundCanvas(canvas) : canvas;
  const nextQuality = config.supportsQuality ? quality ?? DEFAULT_LOSSY_QUALITY : undefined;

  return new Promise<Blob>((resolve, reject) => {
    exportCanvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("当前浏览器可能不支持导出该格式，请尝试其他格式或更新浏览器。"));
      },
      config.mimeType,
      nextQuality,
    );
  });
};

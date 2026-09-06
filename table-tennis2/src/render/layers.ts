// v0.3.0 §5.1.2: 描画基盤。静的レイヤ（L0 背景 / L1 台）のオフスクリーンキャッシュと、
// 作画モジュールが共有する最小のプリミティブを置く。
// `layerKey` が変わったときだけ描画関数を呼ぶ。生成関数を注入できるようにして
// 単体テスト（U-V15）から再生成回数を spy できるようにする。
import {
  projectWorldPoint,
  type ProjectedPoint,
  type ProjectionCamera,
} from "../view/projection.ts";

/** 作画モジュールが受け取る描画面。カメラは読み取り専用で、演出で加算しない（N-4）。 */
export interface SceneSurface {
  readonly context: CanvasRenderingContext2D;
  readonly camera: ProjectionCamera;
  readonly width: number;
  readonly height: number;
}

export function projectOn(
  surface: SceneSurface,
  x: number,
  y: number,
  z: number,
): ProjectedPoint {
  return projectWorldPoint(surface.camera, x, y, z);
}

/** 投影済み4点の四角形を塗る。 */
export function quad(
  context: CanvasRenderingContext2D,
  first: ProjectedPoint,
  second: ProjectedPoint,
  third: ProjectedPoint,
  fourth: ProjectedPoint,
  fill: string | CanvasGradient,
): void {
  context.beginPath();
  context.moveTo(first.x, first.y);
  context.lineTo(second.x, second.y);
  context.lineTo(third.x, third.y);
  context.lineTo(fourth.x, fourth.y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

/** 角丸矩形のパスを作る（塗り・線は呼び出し側）。 */
export function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  initialRadius: number,
): void {
  const radius = Math.min(initialRadius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height,
  );
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export interface LayerSurface {
  /** drawImage() に渡せる描画結果。 */
  readonly image: CanvasImageSource;
  readonly context: CanvasRenderingContext2D;
}

export type LayerSurfaceFactory = (
  widthPx: number,
  heightPx: number,
) => LayerSurface;

export type LayerDraw = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

/** 表示Canvasと同じ内部解像度（CSS px × dpr）で再生成の要否を決める鍵。 */
export function layerKey(
  width: number,
  height: number,
  dpr: number,
): string {
  return `${width}x${height}@${dpr}`;
}

/** OffscreenCanvas が使えれば使い、なければ <canvas> を使う（API は共通部分のみ）。 */
export function createLayerSurface(
  widthPx: number,
  heightPx: number,
): LayerSurface {
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(widthPx, heightPx);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("オフスクリーンCanvasの2Dコンテキストを取得できません。");
    }
    return {
      image: canvas as unknown as CanvasImageSource,
      context: context as unknown as CanvasRenderingContext2D,
    };
  }
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("オフスクリーンCanvasの2Dコンテキストを取得できません。");
  }
  return { image: canvas, context };
}

export class LayerCache {
  private key: string | null = null;
  private surface: LayerSurface | null = null;
  // Node の型ストリップはパラメータプロパティを扱えないため明示フィールドにする。
  private readonly factory: LayerSurfaceFactory;

  public constructor(factory: LayerSurfaceFactory = createLayerSurface) {
    this.factory = factory;
  }

  /**
   * 現在の寸法・DPR に対応する静的レイヤを返す。key が変わらない限り
   * `draw` は呼ばれない（orientationchange の即時 + 250ms 再 resize でも同じ）。
   */
  public ensure(
    width: number,
    height: number,
    dpr: number,
    draw: LayerDraw,
  ): CanvasImageSource | null {
    if (!(width > 0) || !(height > 0) || !(dpr > 0)) {
      return null;
    }
    const key = layerKey(width, height, dpr);
    if (key === this.key && this.surface) {
      return this.surface.image;
    }
    const surface = this.factory(
      Math.round(width * dpr),
      Math.round(height * dpr),
    );
    const context = surface.context;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    draw(context, width, height);
    this.surface = surface;
    this.key = key;
    return surface.image;
  }

  /** 次の ensure() で必ず再生成させる。 */
  public invalidate(): void {
    this.key = null;
    this.surface = null;
  }
}

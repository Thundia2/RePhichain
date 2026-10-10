// *** PAUSED / ON HOLD — Part of GPU renderer (usePixiRenderer setting) ***
// ============================================================
// PixiShaderFilter — Adapts existing GLSL shaders to Pixi v8 Filters
//
// Recent change: Initial creation for Phase 3 post-processing integration.
// Converts prpr-style fragment shaders (varying vec2 uv, screenTexture)
// to Pixi v8 filter conventions (vTextureCoord, uTexture) with automatic
// uniform handling. Supports animated variables from the chart effects system.
//
// This replaces the separate WebGL overlay canvas (PostProcessPipeline)
// with Pixi's built-in filter system, using a single WebGL context.
// ============================================================

import { Filter, GlProgram } from "pixi.js";
import { BUILTIN_SHADERS, SHADER_DEFAULTS } from "../shaders";
import { evaluateAnimatedVariable, evaluateAnimatedVariableVec } from "../postProcess";
import type { ShaderEffect } from "../../types/extra";
import { beatToFloat } from "../../types/chart";

// ============================================================
// Shader source adaptation
// ============================================================

/**
 * Convert a prpr-style fragment shader to Pixi v8 filter format.
 *
 * Replacements:
 *   - `varying vec2 uv` → `in vec2 vTextureCoord` (Pixi provides this)
 *   - `uniform sampler2D screenTexture` → `uniform sampler2D uTexture`
 *   - `texture2D(screenTexture, ...)` → `texture2D(uTexture, ...)`
 *   - References to `uv` → `vTextureCoord`
 *   - Remove `attribute` declarations (vertex shader handles these)
 *   - Remove standalone uniform declarations for screenSize/time (we re-declare them)
 *
 * We also wrap the shader in a header that declares the custom uniforms
 * from SHADER_DEFAULTS as a UBO-compatible struct.
 */
function adaptShaderSource(originalSource: string, _shaderName: string): string {
  // `_shaderName` is kept in the signature for debug/logging hook-in but
  // isn't read in the adaptation itself. Prefixed with `_` so the
  // noUnusedParameters lint is satisfied.
  let src = originalSource;

  // Replace the screenTexture sampler name
  src = src.replace(/uniform\s+sampler2D\s+screenTexture\s*;/g, "uniform sampler2D uTexture;");
  src = src.replace(/screenTexture/g, "uTexture");

  // Replace varying uv with Pixi's vTextureCoord
  // Be careful: only replace `uv` as a standalone identifier, not inside words like "curve"
  src = src.replace(/varying\s+vec2\s+uv\s*;/g, "in vec2 vTextureCoord;");

  // Replace standalone `uv` references with `vTextureCoord`
  // Use word boundary matching to avoid replacing inside other identifiers
  src = src.replace(/\buv\b/g, "vTextureCoord");

  // Pixi v8 uses `in` instead of `varying` for fragment shader inputs (GLSL 300 es)
  // But GlProgram handles this conversion automatically, so we can use either.
  // The key is that vTextureCoord is provided by Pixi's default vertex shader.

  return src;
}

// ============================================================
// Cache for compiled GlPrograms
// ============================================================

const programCache = new Map<string, GlProgram>();

// Minimal filter vertex shader for Pixi v8, matching the built-in
// filter vertex (provides `vTextureCoord` to the fragment stage).
// Inlined here so GlProgramOptions.vertex is explicitly satisfied —
// TypeScript marks `vertex` as required even though Pixi runtime
// would accept omission. Verbatim port of Pixi v8's defaultFilterVert.
const DEFAULT_FILTER_VERTEX_SHADER = `in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}`;

function getOrCreateProgram(shaderName: string, fragmentSource: string): GlProgram {
  let program = programCache.get(shaderName);
  if (!program) {
    const adaptedFragment = adaptShaderSource(fragmentSource, shaderName);
    program = new GlProgram({
      fragment: adaptedFragment,
      vertex: DEFAULT_FILTER_VERTEX_SHADER,
    });
    programCache.set(shaderName, program);
  }
  return program;
}

// ============================================================
// Factory: create a Pixi Filter from a ShaderEffect
// ============================================================

/**
 * Create a Pixi Filter for a chart shader effect.
 *
 * The filter wraps the existing GLSL fragment shader with Pixi's
 * filter system, handling uniform setup and animated variable evaluation.
 *
 * @param effect The ShaderEffect from the chart's extraConfig
 * @returns A configured Filter, or null if the shader source is not found
 */
export function createChartFilter(effect: ShaderEffect): Filter | null {
  // Get shader source
  const shaderSource = effect.customShaderSource ?? BUILTIN_SHADERS[effect.shader];
  if (!shaderSource) return null;

  // Get or create the GlProgram
  const glProgram = getOrCreateProgram(effect.shader, shaderSource);

  // Build uniform resources from SHADER_DEFAULTS
  const defaults = SHADER_DEFAULTS[effect.shader] ?? {};
  const uniformDefs: Record<string, { value: number | Float32Array; type: string }> = {};

  // Standard uniforms that all shaders can use
  uniformDefs["screenSize"] = { value: new Float32Array([800, 600]), type: "vec2<f32>" };
  uniformDefs["time"] = { value: 0, type: "f32" };

  // Effect-specific uniforms from defaults
  for (const [name, defaultVal] of Object.entries(defaults)) {
    if (Array.isArray(defaultVal)) {
      if (defaultVal.length === 2) {
        uniformDefs[name] = { value: new Float32Array(defaultVal), type: "vec2<f32>" };
      } else if (defaultVal.length === 3) {
        uniformDefs[name] = { value: new Float32Array(defaultVal), type: "vec3<f32>" };
      } else if (defaultVal.length === 4) {
        uniformDefs[name] = { value: new Float32Array(defaultVal), type: "vec4<f32>" };
      }
    } else {
      uniformDefs[name] = { value: defaultVal, type: "f32" };
    }
  }

  const filter = new Filter({
    glProgram,
    resources: {
      chartUniforms: uniformDefs,
    },
  });

  return filter;
}

/**
 * Update a chart filter's uniforms for the current frame.
 *
 * Evaluates animated variables from the effect definition
 * and sets them on the filter.
 *
 * @param filter The Pixi Filter to update
 * @param effect The ShaderEffect with variable definitions
 * @param currentBeat Current playback beat
 * @param currentTime Current time in seconds
 * @param canvasWidth Canvas width for screenSize uniform
 * @param canvasHeight Canvas height for screenSize uniform
 */
export function updateChartFilterUniforms(
  filter: Filter,
  effect: ShaderEffect,
  currentBeat: number,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  // X1: route uniform writes through the v8 UniformGroup accessor.
  // In Pixi v8 the Shader constructor wraps `resources.chartUniforms` (the plain
  // {name:{value,type}} record we passed to createChartFilter) into a UniformGroup,
  // whose `.uniforms` is a FLATTENED map of name -> raw value (number | Float32Array)
  // — the {value,type} wrapper is stripped (see node_modules/pixi.js .../UniformGroup.d.ts
  // ExtractUniformObject). The old code wrote `uniforms.foo.value[i]`, but `.value` is
  // undefined on the flattened value, so it threw a TypeError every frame and froze the
  // preview. Correct v8 form: scalars assign directly, vectors index the Float32Array
  // directly. grep updateChartFilterUniforms for the call site (PixiGameRenderer).
  const uniforms = filter.resources.chartUniforms?.uniforms as
    | Record<string, number | Float32Array>
    | undefined;
  if (!uniforms) return;

  // Standard uniforms — screenSize is a vec2 Float32Array, written in place.
  const screenSize = uniforms.screenSize;
  if (screenSize instanceof Float32Array) {
    screenSize[0] = canvasWidth;
    screenSize[1] = canvasHeight;
  }
  if (typeof uniforms.time === "number") {
    uniforms.time = currentTime;
  }

  // Effect-specific uniforms
  const defaults = SHADER_DEFAULTS[effect.shader] ?? {};

  if (effect.vars) {
    for (const [name, value] of Object.entries(effect.vars)) {
      const target = uniforms[name];
      if (target === undefined) continue;

      if (typeof value === "number") {
        uniforms[name] = value;
      } else {
        const defVal = defaults[name];
        if (Array.isArray(defVal) && target instanceof Float32Array) {
          const vec = evaluateAnimatedVariableVec(value, currentBeat, defVal.length);
          // Normalize RGBA colors (0-255 → 0.0-1.0)
          if (vec.length === 4 && vec.some(v => v > 1.0)) {
            for (let i = 0; i < vec.length; i++) vec[i] /= 255.0;
          }
          for (let i = 0; i < vec.length; i++) {
            target[i] = vec[i];
          }
        } else {
          uniforms[name] = evaluateAnimatedVariable(value, currentBeat);
        }
      }
    }
  }

  // Set defaults for any vars not explicitly set
  for (const [name, defaultVal] of Object.entries(defaults)) {
    if (effect.vars && name in effect.vars) continue;
    const target = uniforms[name];
    if (target === undefined) continue;

    if (Array.isArray(defaultVal) && target instanceof Float32Array) {
      for (let i = 0; i < defaultVal.length; i++) {
        target[i] = defaultVal[i];
      }
    } else if (!Array.isArray(defaultVal)) {
      uniforms[name] = defaultVal;
    }
  }
}

/**
 * Check if a ShaderEffect is active at the current beat.
 */
export function isEffectActive(effect: ShaderEffect, currentBeat: number): boolean {
  const start = beatToFloat(effect.start);
  const end = beatToFloat(effect.end);
  return currentBeat >= start && currentBeat <= end;
}

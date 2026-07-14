/**
 * @module lib/settingsSets
 * @description Configurable "settings sets" (policy presets) that score a repo
 * against a list of checks. Presets are defined in `server/settings-sets.json`
 * (JSON config, not built-in code and not a plugin system) so they can be
 * edited without a deploy. The first shipped preset only evaluates fields
 * already present on the synced repo object — no extra GitHub API calls.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_SETS_PATH = path.join(__dirname, "..", "settings-sets.json");

// Each evaluator reads one field off the repo object and returns a boolean.
// Deliberately data-driven (not arbitrary code) so presets stay a JSON config
// concern, not a plugin/eval surface.
const CHECK_EVALUATORS = {
  nonEmpty: (value) => typeof value === "string" && value.trim().length > 0,
  nonEmptyArray: (value) => Array.isArray(value) && value.length > 0,
  truthy: (value) => Boolean(value),
  falsy: (value) => !value,
};

let cachedPresets = null;

function loadPresets() {
  if (cachedPresets) return cachedPresets;
  const raw = fs.readFileSync(SETTINGS_SETS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  cachedPresets = Array.isArray(parsed.presets) ? parsed.presets : [];
  return cachedPresets;
}

/**
 * Lists available presets (summary shape — no check details) for the settings-sets menu.
 *
 * @returns {Array<{ id: string, name: string, description: string, checkCount: number }>}
 */
export function getSettingsSets() {
  return loadPresets().map(({ id, name, description, checks }) => ({
    id,
    name,
    description,
    checkCount: checks.length,
  }));
}

/**
 * @param {string} id
 * @returns {object|null} The full preset (including its checks), or null if unknown.
 */
export function findPreset(id) {
  return loadPresets().find((p) => p.id === id) ?? null;
}

/**
 * Evaluates one repo against one preset's checks.
 *
 * @param {object} repo - A repo object from `repoCache` (see `github.js` → `mapRepo()`).
 * @param {object} preset - A preset as returned by {@link findPreset}.
 * @returns {{ presetId: string, presetName: string, checks: Array<{id: string, label: string, pass: boolean}>, passCount: number, total: number }}
 */
export function evaluatePreset(repo, preset) {
  const checks = preset.checks.map((check) => {
    const evaluate = CHECK_EVALUATORS[check.type];
    return {
      id: check.id,
      label: check.label,
      pass: evaluate ? evaluate(repo[check.field]) : false,
    };
  });
  return {
    presetId: preset.id,
    presetName: preset.name,
    checks,
    passCount: checks.filter((c) => c.pass).length,
    total: checks.length,
  };
}

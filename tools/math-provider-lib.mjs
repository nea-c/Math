import fs from "node:fs";
import path from "node:path";

export function f32(value) {
  return Math.fround(value);
}

export function constant(value) {
  return f32(value);
}

export function reference(id) {
  return id;
}

export function storage(storageId, providerPath) {
  return {
    type: "minecraft:storage",
    storage: storageId,
    path: providerPath,
  };
}

function aggregate(type, inputs) {
  return {
    type: `minecraft:${type}`,
    inputs: inputs.length === 1 && Array.isArray(inputs[0]) ? inputs[0] : inputs,
  };
}

export function sum(...inputs) {
  return aggregate("add", inputs);
}

export function product(...inputs) {
  return aggregate("mul", inputs);
}

export function minimum(...inputs) {
  return aggregate("min", inputs);
}

export function maximum(...inputs) {
  return aggregate("max", inputs);
}

export function average(...inputs) {
  return aggregate("avg", inputs);
}

function unary(type, input) {
  return { type: `minecraft:${type}`, input };
}

function binary(type, left, right) {
  return { type: `minecraft:${type}`, left, right };
}

export const absolute = input => unary("abs", input);
export const negate = input => unary("negate", input);
export const floor = input => unary("floor", input);
export const ceil = input => unary("ceil", input);
export const round = input => unary("round", input);
export const truncate = input => unary("truncate", input);
export const squareRoot = input => unary("sqrt", input);
export const sine = input => unary("sin", input);
export const cosine = input => unary("cos", input);
export const subtract = (left, right) => binary("sub", left, right);
export const divide = (left, right) => binary("div", left, right);
export const modulo = (left, right) => binary("mod", left, right);
export const power = (base, exponent) => ({ type: "minecraft:pow", base, exponent });
export const length = (...inputs) => aggregate("length", inputs);

function adjacentFloat32(value, direction) {
  const threshold = f32(value);
  if (!Number.isFinite(threshold)) throw new RangeError("Float comparison threshold must be finite");
  if (threshold === 0) return direction < 0 ? -f32(2 ** -149) : f32(2 ** -149);
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setFloat32(0, threshold);
  const bits = view.getUint32(0);
  const incrementBits = (threshold > 0) === (direction > 0);
  view.setUint32(0, incrementBits ? bits + 1 : bits - 1);
  return view.getFloat32(0);
}

// This provider must be evaluated by `data modify ... set compute` before a
// value-check reads it. Adjacent binary32 bounds preserve strict comparison
// without scaling finite differences into Infinity.
export function floatComparison(value, threshold) {
  const roundedThreshold = f32(threshold);
  const lower = adjacentFloat32(roundedThreshold, -1);
  const upper = adjacentFloat32(roundedThreshold, 1);
  const cases = [];
  if (Number.isFinite(lower)) {
    cases.push({
      condition: { type: "minecraft:float_value_check", value, test: { max: lower } },
      value: -1,
    });
  }
  if (Number.isFinite(upper)) {
    cases.push({
      condition: { type: "minecraft:float_value_check", value, test: { min: upper } },
      value: 1,
    });
  }
  return { type: "minecraft:number_dispatcher", cases, default: 0 };
}

export const storageProvider = storage;
export const sumProvider = sum;
export const productProvider = product;
export const minimumProvider = minimum;
export const maximumProvider = maximum;
export const averageProvider = average;

function getValue(values, key) {
  return values instanceof Map ? values.get(key) : values?.[key];
}

function getPath(value, providerPath) {
  return providerPath.replaceAll(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce((current, segment) => getValue(current, segment), value);
}

function readStorage(storageId, providerPath, storageValues) {
  const storageValue = getValue(storageValues, storageId);
  if (storageValue !== undefined) {
    return getPath(storageValue, providerPath);
  }
  return getValue(storageValues, `${storageId}.${providerPath}`) ?? getValue(storageValues, `${storageId}${providerPath}`);
}

function normalizeType(type) {
  return typeof type === "string" ? type.replace(/^minecraft:/, "") : type;
}

function registryValue(referenceId, registry) {
  const value = getValue(registry, referenceId);
  if (value === undefined) {
    throw new Error(`Unknown number provider: ${referenceId}`);
  }
  return value;
}

function evaluateAggregate(inputs, registry, storageValues, initial, operation) {
  let result = f32(initial);
  for (const input of inputs) {
    result = f32(operation(result, evaluateProvider(input, registry, storageValues)));
  }
  return result;
}

function evaluateInlinePredicate(predicate, registry, storageValues) {
  if (!predicate || typeof predicate !== "object") {
    throw new TypeError("Inline predicate must be a predicate object");
  }
  const condition = normalizeType(predicate.type);
  if (condition === "all_of") {
    if (!Array.isArray(predicate.terms)) {
      throw new TypeError("Inline all-of predicate requires a terms array");
    }
    return predicate.terms.every(term => evaluateInlinePredicate(term, registry, storageValues));
  }
  if (condition !== "float_value_check") {
    throw new Error(`Unsupported inline predicate type: ${predicate.type}`);
  }
  const value = evaluateProvider(predicate.value, registry, storageValues);
  const range = predicate.test ?? {};
  if (typeof range === "number" || typeof range === "string") {
    return value === evaluateProvider(range, registry, storageValues);
  }
  const minimum = range.min === undefined ? undefined : evaluateProvider(range.min, registry, storageValues);
  const maximum = range.max === undefined ? undefined : evaluateProvider(range.max, registry, storageValues);
  return (minimum === undefined || value >= minimum) && (maximum === undefined || value <= maximum);
}

function javaInt(value) {
  if (Number.isNaN(value)) return 0;
  if (value >= 2_147_483_647) return 2_147_483_647;
  if (value <= -2_147_483_648) return -2_147_483_648;
  return Math.trunc(value);
}

function evaluateProviderInt(provider, registry, storageValues) {
  if (typeof provider === "number") return javaInt(f32(provider));
  if (typeof provider === "string") {
    return evaluateProviderInt(registryValue(provider, registry), registry, storageValues);
  }
  if (!provider || typeof provider !== "object") {
    throw new TypeError("Number provider must be a number, reference, or provider object");
  }

  const type = normalizeType(provider.type);
  if (type === "constant") return javaInt(f32(provider.value));
  if (type === "reference") {
    return evaluateProviderInt(registryValue(provider.value ?? provider.name ?? provider.reference, registry), registry, storageValues);
  }
  if (type === "storage") return javaInt(f32(readStorage(provider.storage, provider.path, storageValues)));
  if (type === "number_dispatcher") {
    for (const dispatcherCase of provider.cases ?? []) {
      if (evaluateInlinePredicate(dispatcherCase.condition, registry, storageValues)) {
        return evaluateProviderInt(dispatcherCase.value, registry, storageValues);
      }
    }
    return evaluateProviderInt(provider.default ?? 0, registry, storageValues);
  }

  const inputs = provider.inputs;
  if (!Array.isArray(inputs)) {
    throw new TypeError(`Number provider ${provider.type} requires an inputs array`);
  }
  const values = inputs.map(input => evaluateProviderInt(input, registry, storageValues));
  switch (type) {
    case "add":
      return values.reduce((left, right) => (left + right) | 0, 0);
    case "mul":
      return values.reduce((left, right) => Math.imul(left, right), 1);
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "avg":
      return Math.trunc(values.reduce((left, right) => (left + right) | 0, 0) / values.length);
    default:
      throw new Error(`Unsupported number provider type: ${provider.type}`);
  }
}

export function evaluateProvider(provider, registry = new Map(), storageValues = new Map()) {
  if (typeof provider === "number") {
    return f32(provider);
  }
  if (typeof provider === "string") {
    return evaluateProvider(registryValue(provider, registry), registry, storageValues);
  }
  if (!provider || typeof provider !== "object") {
    throw new TypeError("Number provider must be a number, reference, or provider object");
  }

  const type = normalizeType(provider.type);
  if (type === "constant") {
    return f32(provider.value);
  }
  if (type === "reference") {
    return evaluateProvider(registryValue(provider.value ?? provider.name ?? provider.reference, registry), registry, storageValues);
  }
  if (type === "storage") {
    return f32(readStorage(provider.storage, provider.path, storageValues));
  }
  if (type === "number_dispatcher") {
    if (!Array.isArray(provider.cases)) {
      throw new TypeError(`Number provider ${provider.type} requires a cases array`);
    }
    for (const dispatcherCase of provider.cases) {
      if (evaluateInlinePredicate(dispatcherCase.condition, registry, storageValues)) {
        return evaluateProvider(dispatcherCase.value, registry, storageValues);
      }
    }
    return evaluateProvider(provider.default ?? 0, registry, storageValues);
  }

  const unaryValue = () => evaluateProvider(provider.input, registry, storageValues);
  const left = () => evaluateProvider(provider.left, registry, storageValues);
  const right = () => evaluateProvider(provider.right, registry, storageValues);
  const inputs = provider.inputs;
  switch (type) {
    case "abs": return f32(Math.abs(unaryValue()));
    case "negate": return f32(-unaryValue());
    case "floor": return f32(Math.floor(unaryValue()));
    case "ceil": return f32(Math.ceil(unaryValue()));
    case "round": return f32(Math.floor(unaryValue() + 0.5));
    case "truncate": return f32(Math.trunc(unaryValue()));
    case "sqrt": return f32(Math.sqrt(unaryValue()));
    case "sin": return f32(Math.sin(unaryValue()));
    case "cos": return f32(Math.cos(unaryValue()));
    case "sub": return f32(left() - right());
    case "div": return f32(left() / right());
    case "mod": return f32(left() % right());
    case "pow": return f32(Math.pow(
      evaluateProvider(provider.base, registry, storageValues),
      evaluateProvider(provider.exponent, registry, storageValues),
    ));
    case "add":
      return evaluateAggregate(inputs, registry, storageValues, 0, (leftValue, rightValue) => leftValue + rightValue);
    case "mul":
      return evaluateAggregate(inputs, registry, storageValues, 1, (leftValue, rightValue) => leftValue * rightValue);
    case "min":
      return Math.min(...inputs.map(input => evaluateProvider(input, registry, storageValues)));
    case "max":
      return Math.max(...inputs.map(input => evaluateProvider(input, registry, storageValues)));
    case "avg": {
      const total = evaluateAggregate(inputs, registry, storageValues, 0, (leftValue, rightValue) => leftValue + rightValue);
      return f32(total / inputs.length);
    }
    case "length": return f32(Math.hypot(...inputs.map(input => evaluateProvider(input, registry, storageValues))));
    default:
      throw new Error(`Unsupported number provider type: ${provider.type}`);
  }
}

export function writeGeneratedJson(root, relativePath, value) {
  const target = path.join(root, ...relativePath.split("/")) + ".json";
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
  return target;
}

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

function aggregate(type, operands) {
  return {
    type: `minecraft:${type}`,
    operands: operands.length === 1 && Array.isArray(operands[0]) ? operands[0] : operands,
  };
}

export function sum(...operands) {
  return aggregate("sum", operands);
}

export function product(...operands) {
  return aggregate("product", operands);
}

export function minimum(...operands) {
  return aggregate("minimum", operands);
}

export function maximum(...operands) {
  return aggregate("maximum", operands);
}

export function average(...operands) {
  return aggregate("average", operands);
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
  return providerPath.split(".").reduce((current, segment) => getValue(current, segment), value);
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

function evaluateAggregate(operands, registry, storageValues, initial, operation) {
  let result = f32(initial);
  for (const operand of operands) {
    result = f32(operation(result, evaluateProvider(operand, registry, storageValues)));
  }
  return result;
}

function evaluateInlinePredicate(predicate, registry, storageValues) {
  if (!predicate || typeof predicate !== "object") {
    throw new TypeError("Inline predicate must be a predicate object");
  }
  const condition = normalizeType(predicate.type);
  if (condition !== "value_check") {
    throw new Error(`Unsupported inline predicate type: ${predicate.type}`);
  }
  const value = evaluateProvider(predicate.value, registry, storageValues);
  const range = predicate.range ?? {};
  return (range.min === undefined || value >= f32(range.min))
    && (range.max === undefined || value <= f32(range.max));
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
        return evaluateProvider(dispatcherCase.number_provider, registry, storageValues);
      }
    }
    return evaluateProvider(provider.default ?? 0, registry, storageValues);
  }

  const operands = provider.operands;
  if (!Array.isArray(operands)) {
    throw new TypeError(`Number provider ${provider.type} requires an operands array`);
  }
  switch (type) {
    case "sum":
      return evaluateAggregate(operands, registry, storageValues, 0, (left, right) => left + right);
    case "product":
      return evaluateAggregate(operands, registry, storageValues, 1, (left, right) => left * right);
    case "minimum":
      return evaluateAggregate(operands, registry, storageValues, Infinity, Math.min);
    case "maximum":
      return evaluateAggregate(operands, registry, storageValues, -Infinity, Math.max);
    case "average": {
      const total = evaluateAggregate(operands, registry, storageValues, 0, (left, right) => left + right);
      return f32(total / operands.length);
    }
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

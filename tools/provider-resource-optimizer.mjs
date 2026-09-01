const providerPathPattern = /^Math\/data\/([^/]+)\/context_float_provider\/(.+)\.json$/;
const resourceLocationPattern = /(?:^|[^a-z0-9_.-])([a-z0-9_.-]+:[a-z0-9_./-]+)/g;

function providerId(file) {
  const match = providerPathPattern.exec(file.relativePath);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function referencedIds(value, knownIds, result = new Set()) {
  if (typeof value === "string") {
    if (knownIds.has(value)) result.add(value);
    return result;
  }
  if (Array.isArray(value)) {
    for (const child of value) referencedIds(child, knownIds, result);
    return result;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) referencedIds(child, knownIds, result);
  }
  return result;
}

function referencedTextIds(text, knownIds) {
  const result = new Set();
  for (const match of text.matchAll(resourceLocationPattern)) {
    if (knownIds.has(match[1])) result.add(match[1]);
  }
  return result;
}

function replaceReference(value, id, replacement) {
  if (value === id) return replacement;
  if (Array.isArray(value)) return value.map(child => replaceReference(child, id, replacement));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, replaceReference(child, id, replacement)]),
  );
}

function pruneUnreachableProviders(files) {
  const providers = new Map();
  for (const file of files) {
    const id = providerId(file);
    if (id) providers.set(id, file);
  }
  const knownIds = new Set(providers.keys());
  const dependencies = new Map(
    [...providers].map(([id, file]) => [id, referencedIds(file.value, knownIds)]),
  );
  const reachable = new Set();
  const pending = [];

  for (const file of files) {
    if (providerId(file)) continue;
    const references = file.kind === "json"
      ? referencedIds(file.value, knownIds)
      : referencedTextIds(file.text, knownIds);
    pending.push(...references);
  }

  while (pending.length > 0) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    pending.push(...(dependencies.get(id) ?? []));
  }

  return files.filter(file => {
    const id = providerId(file);
    return id === undefined || reachable.has(id);
  });
}

function inlineSmallSingleUseProviders(files, maxInlineBytes) {
  let optimized = files;
  while (true) {
    const providers = new Map();
    for (const file of optimized) {
      const id = providerId(file);
      if (id) providers.set(id, file);
    }
    const knownIds = new Set(providers.keys());
    const jsonConsumers = new Map([...knownIds].map(id => [id, []]));
    const textReferences = new Set();

    const collectJsonReferences = (value, file) => {
      if (typeof value === "string") {
        if (knownIds.has(value)) jsonConsumers.get(value).push(file);
        return;
      }
      if (Array.isArray(value)) {
        for (const child of value) collectJsonReferences(child, file);
      } else if (value && typeof value === "object") {
        for (const child of Object.values(value)) collectJsonReferences(child, file);
      }
    };

    for (const file of optimized) {
      if (file.kind === "json") {
        collectJsonReferences(file.value, file);
      } else {
        for (const id of referencedTextIds(file.text, knownIds)) textReferences.add(id);
      }
    }

    const candidate = [...providers].find(([id, file]) => (
      !textReferences.has(id)
      && jsonConsumers.get(id).length === 1
      && Buffer.byteLength(JSON.stringify(file.value)) <= maxInlineBytes
    ));
    if (!candidate) return optimized;

    const [id, provider] = candidate;
    const consumer = jsonConsumers.get(id)[0];
    optimized = optimized
      .filter(file => file !== provider)
      .map(file => file === consumer
        ? { ...file, value: replaceReference(file.value, id, provider.value) }
        : file);
  }
}

export function optimizeProviderResources(files, { maxInlineBytes = 0 } = {}) {
  const reachable = pruneUnreachableProviders(files);
  return maxInlineBytes > 0
    ? inlineSmallSingleUseProviders(reachable, maxInlineBytes)
    : reachable;
}

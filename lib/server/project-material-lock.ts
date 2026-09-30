import { createHash } from "node:crypto";
import { requireDb } from "@/lib/db";
import { exactPart, referenceKind, referenceMatchesPart } from "@/lib/agent/design-materials";
import { materialLockSchema, type MaterialLock } from "@/lib/agent/material-lock";
import { retrieveKnowledge, type RetrievalSource } from "@/lib/agent/knowledge-retrieval";
import { knowledgeHash } from "./knowledge-state";
import { corpusRevision, loadAuthorizedCorpus, retrieveAuthorizedKnowledge, RetrievalAccessError, type AuthorizedCorpus, type KnowledgeReader } from "./knowledge-retrieval-service";
import { privateIndexRevision, queryPrivateIndex } from "./retrieval-client";

export const MATERIAL_LOCK_BYTES = 32 * 1024;
const defaults = { load: loadAuthorizedCorpus, revision: privateIndexRevision, search: queryPrivateIndex };
type Binding = { userId: string; projectId: string; designId: string; bom: { model: string }[] };
function seal(value: Omit<MaterialLock, "hash">): MaterialLock {
  return materialLockSchema.parse({ ...value, hash: knowledgeHash(value) });
}
function unsigned(lock: MaterialLock) { const value = { ...lock } as Partial<MaterialLock>; delete value.hash; return value; }
export function validMaterialLock(lock: MaterialLock, projectId: string, designId: string, bom: { model: string }[]) {
  const parsed = materialLockSchema.safeParse(lock);
  return parsed.success && lock.projectId === projectId && lock.designId === designId && lock.items.length === bom.length
    && lock.hash === knowledgeHash(unsigned(lock)) && Buffer.byteLength(JSON.stringify(lock)) <= MATERIAL_LOCK_BYTES
    && lock.items.every((item, i) => item.bomIndex === i && item.model === exactPart(bom[i].model)
      && item.references.every(index => lock.references[index] && item.model && referenceMatchesPart(item.model, lock.references[index])))
    && lock.references.every(ref => ref.scope !== "project" || ref.projectId === projectId);
}

// One authorized DB snapshot, one query per distinct exact part, sequential IO.
// Timeout returns an honest partial lock; late read completions cannot mutate it.
export async function supplementDesignMaterials(binding: Binding, parentSignal: AbortSignal, budgetMs = 8000, deps = defaults): Promise<MaterialLock> {
  const state: Omit<MaterialLock, "hash"> = { version: "component-materials-v1", projectId: binding.projectId, designId: binding.designId,
    createdAt: new Date().toISOString(), revision: createHash("sha256").update("unavailable").digest("hex"), partial: false, reasons: [], references: [],
    items: binding.bom.map((row, bomIndex) => ({ bomIndex, model: exactPart(row.model), status: exactPart(row.model) ? "deferred" : "ambiguous", references: [] })) };
  const controller = new AbortController(); const signal = AbortSignal.any([parentSignal, controller.signal]);
  const mark = (reason: MaterialLock["reasons"][number]) => { state.partial = true; if (!state.reasons.includes(reason)) state.reasons.push(reason); };
  parentSignal.throwIfAborted();
  if (budgetMs <= 0) { mark("BUDGET"); return seal(state); }
  const work = async () => {
    const corpus = await deps.load({ userId: binding.userId, projectId: binding.projectId, query: "资料配套", purpose: "design" }); signal.throwIfAborted();
    let indexRevision = "unavailable";
    try { indexRevision = await deps.revision(signal); } catch { signal.throwIfAborted(); mark("INDEX_UNAVAILABLE"); }
    signal.throwIfAborted(); state.revision = corpusRevision(corpus, indexRevision);
    const seen = new Map<string, MaterialLock["items"][number]>();
    for (const item of state.items) {
      signal.throwIfAborted(); if (!item.model) continue;
      const previous = seen.get(item.model);
      if (previous) { item.status = previous.status; item.references = [...previous.references]; continue; }
      seen.set(item.model, item);
      let sources = [...corpus.sources]; let failed = indexRevision === "unavailable";
      if (!failed) try {
        const indexed = await deps.search(item.model, signal); signal.throwIfAborted();
        if (indexed.revision !== indexRevision) { mark("REVISION_CHANGED"); return; }
        sources = sources.concat(indexed.sources);
      } catch { signal.throwIfAborted(); mark("INDEX_UNAVAILABLE"); failed = true; }
      // Filter BEFORE top-five selection, retaining document-kind diversity.
      sources = sources.filter(source => referenceMatchesPart(item.model!, { title: source.version.title, source: source.version.source }));
      const found = (["datasheet", "schematic", "pinmap", "example", "other"] as const).flatMap(kind =>
        retrieveKnowledge(item.model!, sources.filter(source => referenceKind(source.version.title, source.version.source) === kind)).references.slice(0, 1));
      const kinds = new Set<string>();
      for (const ref of found) {
        const kind = referenceKind(ref.title, ref.source); if (kinds.has(kind) || item.references.length === 4) continue;
        const key = (r: typeof ref) => JSON.stringify([r.scope, r.id, r.version, r.sha256, r.source]);
        let index = state.references.findIndex(r => key(r) === key(ref));
        if (index < 0) {
          if (state.references.length === 24) { mark("SOURCE_LIMIT"); continue; }
          index = state.references.length; state.references.push(ref);
          if (Buffer.byteLength(JSON.stringify(seal(state))) > MATERIAL_LOCK_BYTES - 2048) { state.references.pop(); mark("SOURCE_LIMIT"); continue; }
        }
        kinds.add(kind); item.references.push(index);
      }
      item.status = item.references.length ? "matched" : failed || state.reasons.includes("SOURCE_LIMIT") ? "deferred" : "missing";
    }
    if (indexRevision !== "unavailable") {
      try { const current = await deps.revision(signal); signal.throwIfAborted(); if (current !== indexRevision) mark("REVISION_CHANGED"); }
      catch { signal.throwIfAborted(); mark("INDEX_UNAVAILABLE"); }
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  try {
    await Promise.race([work(), new Promise<void>(resolve => { timer = setTimeout(() => { mark("BUDGET"); controller.abort(); resolve(); }, Math.max(0, Math.min(8000, budgetMs))); }),
      new Promise<never>((_resolve, reject) => { onAbort = () => { controller.abort(); reject(parentSignal.reason); }; parentSignal.addEventListener("abort", onAbort, { once: true }); })]);
    parentSignal.throwIfAborted();
  } catch (error) {
    parentSignal.throwIfAborted(); if (error instanceof RetrievalAccessError) throw error;
    mark("SOURCE_UNAVAILABLE");
  } finally { clearTimeout(timer); parentSignal.removeEventListener("abort", onAbort); controller.abort(); }
  if (state.reasons.includes("REVISION_CHANGED")) {
    state.references = []; for (const item of state.items) if (item.model) { item.status = "deferred"; item.references = []; }
  }
  return seal(state);
}

export function materialLockIsCurrent(lock: MaterialLock, corpus: AuthorizedCorpus, indexRevision: string) {
  return !lock.partial && lock.revision === corpusRevision(corpus, indexRevision) && lock.references.every(ref => ref.scope === "platform" && ref.reviewStatus === "auto-indexed"
    || corpus.sources.some(source => source.scope === ref.scope && source.id === ref.id && source.version.version === ref.version && source.version.sha256 === ref.sha256));
}
export type MaterialLockState = "absent" | "active" | "stale" | "partial" | "invalid" | "unavailable";
// Never trust an old cache as authorization. Invalidated caches are not silently
// rewritten; historical downloads keep their locked versions and hashes.
export async function retrieveProjectMaterials(request: { userId: string; projectId: string; query: string; designId?: string; bom?: { model: string }[]; lock?: MaterialLock }, database: KnowledgeReader = requireDb(), deps = { ...defaults, fresh: retrieveAuthorizedKnowledge }) {
  const { lock } = request; let lockState: MaterialLockState = "absent";
  if (lock) {
    lockState = !request.designId || !request.bom || !validMaterialLock(lock, request.projectId, request.designId, request.bom) ? "invalid" : lock.partial ? "partial" : "stale";
    // Ownership is checked even for a matching cached revision.
    const corpus = await deps.load({ ...request, purpose: "agent" }, database);
    if (lockState === "stale") {
      try {
        const revision = await deps.revision();
        if (materialLockIsCurrent(lock, corpus, revision)) {
          lockState = "active";
          const sources: RetrievalSource[] = lock.references.map(ref => ({ scope: ref.scope, id: ref.id, projectId: ref.projectId, reviewStatus: ref.reviewStatus,
            version: { title: ref.title, source: ref.source, content: ref.excerpt, version: ref.version, sha256: ref.sha256, kind: "manual", reviewedBy: "locked-source", reviewedAt: lock.createdAt } }));
          const mentioned = (request.query.toUpperCase().match(/[A-Z0-9]+(?:[-_.+][A-Z0-9]+)*/g) ?? []).map(exactPart).filter((part): part is string => !!part);
          const outsideLock = mentioned.some(part => !lock.items.some(item => item.model === part));
          const cached = outsideLock ? retrieveKnowledge(request.query, []) : retrieveKnowledge(request.query, sources, true);
          // Generic project analysis still needs its locked device references.
          if (!outsideLock && !cached.references.length) Object.assign(cached, retrieveKnowledge(lock.items.flatMap(item => item.model ? [item.model] : []).join(" "), sources, true));
          if (cached.references.length) return { retrieval: { ...cached, revision: lock.revision }, lockState, cached: true };
        }
      } catch { lockState = "unavailable"; }
    }
  }
  const retrieval = await deps.fresh({ ...request, purpose: "agent" }, database);
  if (lockState === "active" && retrieval.revision !== lock?.revision) lockState = "stale";
  return { retrieval, lockState, cached: false };
}

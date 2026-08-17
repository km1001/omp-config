"use strict";

const invoke = (name, args) => {
  const b = window.go.main.App;
  switch (name) {
    case "load_config": return b.LoadConfig();
    case "save_config": return b.SaveConfig(args.config);
    case "test_provider": return b.TestProvider(args.baseUrl, args.apiKey, args.api);
    case "get_constants": return b.GetConstants();
  }
  return Promise.reject("unknown command: " + name);
};

const state = {
  config: null,
  path: "",
  dirty: false,
  view: null,          // "provider" | "global"
  selectedProvider: null,
  selectedModel: null,
  constants: null,
  keyVisible: false,
};

const $ = (id) => document.getElementById(id);

const els = {};
["path-chip","btn-new","btn-reload","btn-save","btn-add-provider","btn-global",
 "provider-list","provider-panel","global-panel","f-provider-name","btn-test",
 "btn-delete-provider","f-baseurl","f-api","f-auth","f-apikey","btn-toggle-key",
 "f-strict","fold-headers","headers-rows","btn-add-header","fold-discovery",
 "f-discovery-type","f-discovery-url","fold-overrides","overrides-rows",
 "btn-add-override","model-list","btn-add-model","fold-equiv","equiv-rows",
 "btn-add-equiv","fold-order","order-list","btn-add-order","status-text",
 "status-warnings","toast"]
.forEach((id) => (els[id] = $(id)));

/* ---------- helpers ---------- */

function toast(msg, kind = "") {
  els.toast.textContent = msg;
  els.toast.className = kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (els.toast.className = "hidden"), 3500);
}

function setStatus(text, kind = "") {
  els["status-text"].textContent = text;
  els["status-text"].className = kind;
}

function markDirty() {
  if (!state.dirty) {
    state.dirty = true;
    setStatus("unsaved changes", "dirty");
  }
}

function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ---------- view switching ---------- */

function showProvider(name) {
  state.view = "provider";
  state.selectedProvider = name;
  state.selectedModel = null;
  renderAll();
}

function showGlobal() {
  state.view = "global";
  state.selectedProvider = null;
  state.selectedModel = null;
  renderAll();
}

/* ---------- sidebar ---------- */

function renderSidebar() {
  const list = els["provider-list"];
  list.innerHTML = "";
  const names = Object.keys(state.config.providers || {}).sort();
  if (!names.length) {
    const empty = document.createElement("div");
    empty.className = "provider-card";
    empty.style.color = "var(--fg-faint)";
    empty.style.cursor = "default";
    empty.textContent = "no providers yet — add one";
    list.appendChild(empty);
  }
  for (const name of names) {
    const p = state.config.providers[name];
    const card = document.createElement("div");
    card.className = "provider-card" + (state.view === "provider" && state.selectedProvider === name ? " active" : "");
    card.innerHTML = `
      <div>
        <div class="p-name"></div>
        <div class="p-meta"></div>
      </div>
      <span class="p-badge"></span>`;
    card.querySelector(".p-name").textContent = name;
    const nModels = (p.models || []).length;
    card.querySelector(".p-meta").textContent =
      (p.baseUrl || "").replace(/^https?:\/\//, "") || "no baseUrl";
    card.querySelector(".p-badge").textContent = nModels ? String(nModels) : "·";
    card.addEventListener("click", () => showProvider(name));
    list.appendChild(card);
  }
  els["btn-global"].classList.toggle("active", state.view === "global");
}

/* ---------- provider form ---------- */

function renderProviderForm() {
  const p = state.config.providers[state.selectedProvider];
  els["provider-panel"].classList.toggle("hidden", state.view !== "provider");
  els["f-provider-name"].value = state.selectedProvider || "";

  const set = (sel, v) => (els[sel].value = v ?? "");
  set("f-baseurl", p.baseUrl);
  set("f-apikey", p.apiKey);
  set("f-api", p.api || "");
  set("f-auth", p.auth || "");
  set("f-strict", !!p.disableStrictTools);
  set("f-discovery-url", p.discovery?.baseUrl || "");
  set("f-discovery-type", p.discovery?.type || "");
  els["fold-discovery"].open = !!p.discovery;

  const apiSel = els["f-api"];
  apiSel.innerHTML = state.constants.api.map((a) => `<option>${a}</option>`).join("");
  apiSel.value = p.api || "";
  const authSel = els["f-auth"];
  authSel.innerHTML = state.constants.auth.map((a) => `<option>${a}</option>`).join("");
  authSel.value = p.auth || "";
  const discSel = els["f-discovery-type"];
  discSel.innerHTML = state.constants.discovery.map((a) => `<option>${a}</option>`).join("");
  discSel.value = p.discovery?.type || "";

  renderHeaders(p);
  renderOverrides(p);
  renderModels(p);
}

function renderHeaders(p) {
  const rows = els["headers-rows"];
  rows.innerHTML = "";
  const headers = p.headers || {};
  for (const [k, v] of Object.entries(headers)) {
    rows.appendChild(headerRow(p, k, v));
  }
  if (!Object.keys(headers).length) {
    rows.appendChild(headerRow(p, "", ""));
  }
}

function headerRow(p, k, v) {
  const row = document.createElement("div");
  row.className = "kv-row";
  row.innerHTML = `
    <input type="text" placeholder="header name" spellcheck="false">
    <input type="text" placeholder="value" spellcheck="false">
    <button class="row-del" title="remove">✕</button>`;
  const [ki, vi] = row.querySelectorAll("input");
  ki.value = k;
  vi.value = v;
  let t;
  const sync = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const headers = (p.headers = p.headers || {});
      for (const key of Object.keys(headers)) delete headers[key];
      for (const r of rows.querySelectorAll(".kv-row")) {
        const a = r.querySelectorAll("input")[0].value.trim();
        const b = r.querySelectorAll("input")[1].value;
        if (a) headers[a] = b;
      }
      markDirty();
    }, 250);
  };
  ki.addEventListener("input", sync);
  vi.addEventListener("input", sync);
  row.querySelector(".row-del").addEventListener("click", () => {
    row.remove();
    sync();
  });
  return row;
}

function renderOverrides(p) {
  const rows = els["overrides-rows"];
  rows.innerHTML = "";
  const ovs = p.modelOverrides || {};
  if (!Object.keys(ovs).length) {
    rows.appendChild(overrideRow(p, "", ""));
  }
  for (const [id, ov] of Object.entries(ovs)) {
    rows.appendChild(overrideRow(p, id, ov));
  }
}

function overrideRow(p, id, ov) {
  const row = document.createElement("div");
  row.className = "ov-row";
  row.innerHTML = `
    <input type="text" placeholder="model id (e.g. claude-sonnet-4-6)" spellcheck="false">
    <input type="text" placeholder="contextPromotionTarget (e.g. anthropic/claude-opus-4-6)" spellcheck="false">
    <button class="row-del" title="remove">✕</button>`;
  const [ki, vi] = row.querySelectorAll("input");
  ki.value = id;
  vi.value = ov?.contextPromotionTarget || "";
  let t;
  const sync = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const ovs = (p.modelOverrides = p.modelOverrides || {});
      for (const key of Object.keys(ovs)) delete ovs[key];
      for (const r of rows.querySelectorAll(".ov-row")) {
        const a = r.querySelectorAll("input")[0].value.trim();
        const b = r.querySelectorAll("input")[1].value.trim();
        if (a && b) ovs[a] = { contextPromotionTarget: b };
      }
      markDirty();
    }, 250);
  };
  ki.addEventListener("input", sync);
  vi.addEventListener("input", sync);
  row.querySelector(".row-del").addEventListener("click", () => {
    row.remove();
    sync();
  });
  return row;
}

/* ---------- models ---------- */

function renderModels(p) {
  const list = els["model-list"];
  list.innerHTML = "";
  const models = p.models || [];
  if (!models.length) {
    const empty = document.createElement("div");
    empty.className = "model-card";
    empty.style.padding = "12px 14px";
    empty.style.color = "var(--fg-faint)";
    empty.textContent = "no models — declare one below, or use discovery to list them live";
    list.appendChild(empty);
    return;
  }
  models.forEach((m, idx) => {
    const card = document.createElement("div");
    card.className = "model-card";
    const open = state.selectedModel === m.id;
    card.innerHTML = `
      <div class="model-head">
        <span class="model-id"></span>
        <span class="model-tags"></span>
        <span class="model-chev"></span>
      </div>
      <div class="model-body ${open ? "" : "hidden"}"></div>`;
    card.querySelector(".model-id").textContent = m.id;
    const tags = card.querySelector(".model-tags");
    const addTag = (text, cls = "") => {
      const t = document.createElement("span");
      t.className = "tag" + (cls ? " " + cls : "");
      t.textContent = text;
      tags.appendChild(t);
    };
    if (m.reasoning) addTag("reasoning");
    if (m.input?.length) addTag(m.input.join("+"));
    if (m.contextWindow) addTag(`ctx ${m.contextWindow.toLocaleString()}`);
    if (m.maxTokens) addTag(`max ${m.maxTokens.toLocaleString()}`);
    if (m.cost && (m.cost.input != null || m.cost.output != null)) {
      const inp = m.cost.input ?? "-";
      const out = m.cost.output ?? "-";
      addTag(`$${inp}/${out} M`, "cost");
    }
    card.querySelector(".model-chev").textContent = open ? "▾" : "▸";
    card.querySelector(".model-head").addEventListener("click", () => {
      state.selectedModel = open ? null : m.id;
      renderModels(p);
    });
    if (open) {
      const body = card.querySelector(".model-body");
      body.appendChild(modelBody(p, m, idx));
    }
    list.appendChild(card);
  });
}

function modelBody(p, m, idx) {
  const body = document.createElement("div");
  const fields = [
    ["id", "text", m.id, "upstream model id (required)"],
    ["name", "text", m.name ?? "", "display label in picker"],
    ["reasoning", "check", m.reasoning, "accepts a thinking level"],
    ["input", "modalities", m.input, ""],
    ["contextWindow", "number", m.contextWindow ?? "", ""],
    ["maxTokens", "number", m.maxTokens ?? "", ""],
    ["contextPromotionTarget", "text", m.contextPromotionTarget ?? "", "swap target when context would overflow"],
  ];
  for (const [key, type, value, hint] of fields) {
    const wrap = document.createElement("label");
    wrap.className = "field" + (key === "id" || key === "contextPromotionTarget" ? " span2" : "");
    const span = document.createElement("span");
    span.textContent = key;
    if (hint) span.innerHTML += ` <em class="hint">${hint}</em>`;
    wrap.appendChild(span);
    if (type === "check") {
      wrap.classList.add("row");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = !!value;
      box.addEventListener("change", () => {
        m.reasoning = box.checked;
        markDirty();
        renderModels(p);
      });
      wrap.appendChild(box);
    } else if (type === "modalities") {
      const boxWrap = document.createElement("div");
      boxWrap.className = "modality-boxes";
      state.constants.modalities.forEach((mod) => {
        const label = document.createElement("label");
        label.className = "modality-item";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = (m.input || []).includes(mod);
        box.addEventListener("change", () => {
          const list = m.input ? [...m.input] : [];
          const idx = list.indexOf(mod);
          if (box.checked && idx === -1) list.push(mod);
          if (!box.checked && idx !== -1) list.splice(idx, 1);
          m.input = list.length ? list : null;
          markDirty();
          renderModels(p);
        });
        const txt = document.createElement("span");
        txt.textContent = mod;
        label.appendChild(box);
        label.appendChild(txt);
        boxWrap.appendChild(label);
      });
      wrap.appendChild(boxWrap);
    } else {
      const input = document.createElement("input");
      input.type = type;
      input.value = value ?? "";
      input.classList.toggle("invalid", key === "id" && !String(m.id).trim());
      input.spellcheck = false;
      input.addEventListener("input", () => {
        if (key === "id") {
          m.id = input.value;
          if (input.value.trim()) {
            input.classList.remove("invalid");
            state.selectedModel = input.value;
          }
        } else if (key === "name") m.name = input.value;
        else if (key === "contextWindow") m.contextWindow = num(input.value);
        else if (key === "maxTokens") m.maxTokens = num(input.value);
        else if (key === "contextPromotionTarget") m.contextPromotionTarget = input.value || "";
        markDirty();
      });
      wrap.appendChild(input);
    }
    body.appendChild(wrap);
  }
  const costWrap = document.createElement("label");
  costWrap.className = "field span2";
  const costSpan = document.createElement("span");
  costSpan.innerHTML = 'cost <em class="hint">USD per million tokens</em>';
  costWrap.appendChild(costSpan);
  const grid = document.createElement("div");
  grid.className = "form-grid";
  grid.style.background = "none";
  grid.style.border = "none";
  grid.style.padding = "0";
  const costLabels = { input: "input", output: "output", cacheRead: "cache read", cacheWrite: "cache write" };
  for (const [key, label] of Object.entries(costLabels)) {
    const w = document.createElement("label");
    w.className = "field";
    const s = document.createElement("span");
    s.textContent = label;
    w.appendChild(s);
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.min = "0";
    input.value = m.cost?.[key] ?? "";
    input.addEventListener("input", () => {
      const v = num(input.value);
      m.cost = m.cost || {};
      if (v === null) delete m.cost[key];
      else m.cost[key] = v;
      if (!Object.keys(m.cost).length) m.cost = null;
      markDirty();
    });
    w.appendChild(input);
    grid.appendChild(w);
  }
  costWrap.appendChild(grid);
  body.appendChild(costWrap);

  const actions = document.createElement("div");
  actions.className = "model-actions";
  const del = document.createElement("button");
  del.className = "btn danger-ghost small";
  del.textContent = "Delete model";
  del.addEventListener("click", () => {
    p.models.splice(idx, 1);
    state.selectedModel = null;
    markDirty();
    renderModels(p);
  });
  actions.appendChild(del);
  body.appendChild(actions);
  return body;
}

/* ---------- global ---------- */

function renderGlobal() {
  els["global-panel"].classList.toggle("hidden", state.view !== "global");
  renderEquiv();
  renderOrder();
}

function renderEquiv() {
  const rows = els["equiv-rows"];
  rows.innerHTML = "";
  const cfg = state.config;
  const ovs = cfg.equivalence?.overrides || {};
  if (!Object.keys(ovs).length) rows.appendChild(equivRow("", ""));
  for (const [from, to] of Object.entries(ovs)) rows.appendChild(equivRow(from, to));
}

function equivRow(from, to) {
  const row = document.createElement("div");
  row.className = "kv-row";
  row.innerHTML = `
    <input type="text" placeholder="myco/myco-large" spellcheck="false">
    <input type="text" placeholder="claude-sonnet-4-6 (canonical)" spellcheck="false">
    <button class="row-del" title="remove">✕</button>`;
  const [ki, vi] = row.querySelectorAll("input");
  ki.value = from;
  vi.value = to;
  let t;
  const sync = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const ovs = (state.config.equivalence = state.config.equivalence || {});
      ovs.overrides = ovs.overrides || {};
      for (const key of Object.keys(ovs.overrides)) delete ovs.overrides[key];
      for (const r of rows.querySelectorAll(".kv-row")) {
        const a = r.querySelectorAll("input")[0].value.trim();
        const b = r.querySelectorAll("input")[1].value.trim();
        if (a && b) ovs.overrides[a] = b;
      }
      if (!Object.keys(ovs.overrides).length) state.config.equivalence = null;
      markDirty();
    }, 250);
  };
  ki.addEventListener("input", sync);
  vi.addEventListener("input", sync);
  row.querySelector(".row-del").addEventListener("click", () => {
    row.remove();
    sync();
  });
  return row;
}

function renderOrder() {
  const list = els["order-list"];
  list.innerHTML = "";
  const order = state.config.modelProviderOrder || [];
  if (!order.length) {
    const empty = document.createElement("div");
    empty.className = "order-item";
    empty.style.color = "var(--fg-faint)";
    empty.textContent = "no order — earliest entry wins ties; unauthenticated providers are skipped";
    list.appendChild(empty);
    return;
  }
  order.forEach((name, idx) => {
    const item = document.createElement("div");
    item.className = "order-item";
    item.innerHTML = `
      <span class="grip" title="double-click to move up">⠿</span>
      <span class="o-idx">${idx + 1}.</span>
      <input type="text" spellcheck="false">
      <button class="row-del" title="remove">✕</button>`;
    const input = item.querySelector("input");
    input.value = name;
    input.addEventListener("input", () => {
      order[idx] = input.value;
      markDirty();
    });
    item.querySelector(".row-del").addEventListener("click", () => {
      order.splice(idx, 1);
      renderOrder();
      markDirty();
    });
    item.querySelector(".grip").addEventListener("dblclick", () => {
      if (idx > 0) {
        [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
        renderOrder();
        markDirty();
      }
    });
    list.appendChild(item);
  });
}

/* ---------- actions ---------- */

async function load() {
  try {
    const res = await invoke("load_config");
    state.config = res.config;
    state.path = res.path;
    els["path-chip"].textContent = res.path;
    els["path-chip"].title = res.path;
    if (res.migratedFrom) {
      toast(`legacy ${res.migratedFrom} loaded — will migrate to models.yml on save`, "ok");
    }
    state.dirty = false;
    state.selectedProvider = Object.keys(state.config.providers || {})[0] || null;
    state.view = state.selectedProvider ? "provider" : "global";
    state.selectedModel = null;
    renderAll();
    setStatus(res.exists ? "loaded" : "new file — create something, then Save", "saved");
  } catch (e) {
    toast("load failed: " + e, "err");
  }
}

async function save() {
  try {
    const res = await invoke("save_config", { config: state.config });
    state.dirty = false;
    setStatus("saved → " + res.path, "saved");
    els["path-chip"].textContent = res.path;
    if (res.warnings?.length) {
      toast("saved with warnings:\n" + res.warnings.join("\n"), "err");
      els["status-warnings"].textContent = res.warnings.join(" · ");
    } else {
      toast("saved", "ok");
      els["status-warnings"].textContent = "";
    }
  } catch (e) {
    toast("save failed: " + e, "err");
  }
}

async function testConnection() {
  const p = state.config.providers[state.selectedProvider];
  const baseUrl = els["f-baseurl"].value.trim();
  const apiKey = els["f-apikey"].value.trim();
  const api = els["f-api"].value;
  if (!baseUrl) {
    toast("baseUrl is required", "err");
    return;
  }
  els["btn-test"].disabled = true;
  els["btn-test"].textContent = "Testing…";
  try {
    const r = await invoke("test_provider", { baseUrl, apiKey, api });
    const head = r.ok ? "connected" : "failed";
    const detail = r.status ? `HTTP ${r.status}` : r.detail || "unreachable";
    toast(`${head}: ${detail}`, r.ok ? "ok" : "err");
  } catch (e) {
    toast("test error: " + e, "err");
  } finally {
    els["btn-test"].disabled = false;
    els["btn-test"].textContent = "Test";
  }
}

function addProvider() {
  const base = "my-provider";
  let name = base;
  let n = 2;
  while (state.config.providers[name]) name = `${base}-${n++}`;
  state.config.providers[name] = {
    baseUrl: "",
    apiKey: "",
    api: "openai-responses",
    auth: "apiKey",
    models: [],
  };
  state.selectedModel = null;
  markDirty();
  showProvider(name);
}

function addModel() {
  const p = state.config.providers[state.selectedProvider];
  if (!p) return;
  const id = "new-model";
  const m = { id };
  p.models = p.models || [];
  p.models.push(m);
  state.selectedModel = id;
  markDirty();
  renderModels(p);
}

function deleteProvider() {
  const name = state.selectedProvider;
  if (!confirm(`Delete provider '${name}'?`)) return;
  delete state.config.providers[name];
  const names = Object.keys(state.config.providers);
  state.selectedProvider = names[0] || null;
  state.view = state.selectedProvider ? "provider" : "global";
  markDirty();
  renderAll();
}

function renameProvider(oldName, newName) {
  newName = newName.trim();
  if (!newName || newName === oldName) {
    els["f-provider-name"].value = oldName;
    return;
  }
  if (state.config.providers[newName]) {
    toast(`provider '${newName}' already exists`, "err");
    els["f-provider-name"].value = oldName;
    return;
  }
  const p = state.config.providers[oldName];
  delete state.config.providers[oldName];
  state.config.providers[newName] = p;
  const prefix = oldName + "/";
  if (state.config.equivalence?.overrides) {
    for (const [k, v] of Object.entries(state.config.equivalence.overrides)) {
      if (k.startsWith(prefix)) {
        delete state.config.equivalence.overrides[k];
        state.config.equivalence.overrides[newName + k.slice(oldName.length)] = v;
      }
    }
  }
  if (state.config.modelProviderOrder) {
    state.config.modelProviderOrder = state.config.modelProviderOrder.map((n) =>
      n === oldName ? newName : n
    );
  }
  for (const provider of Object.values(state.config.providers)) {
    for (const m of provider.models || []) {
      if (m.contextPromotionTarget?.startsWith(prefix)) {
        m.contextPromotionTarget = newName + m.contextPromotionTarget.slice(oldName.length);
      }
    }
  }
  state.selectedProvider = newName;
  markDirty();
  renderAll();
}

function renderAll() {
  renderSidebar();
  if (state.view === "provider" && state.config.providers[state.selectedProvider]) {
    renderProviderForm();
  } else {
    els["provider-panel"].classList.add("hidden");
    els["global-panel"].classList.remove("hidden");
    renderGlobal();
  }
}

/* ---------- wiring ---------- */

function bindInputs() {
  const providerFields = [
    ["f-baseurl", (p, v) => (p.baseUrl = v)],
    ["f-apikey", (p, v) => (p.apiKey = v)],
    ["f-api", (p, v) => (p.api = v)],
    ["f-auth", (p, v) => (p.auth = v)],
    ["f-discovery-type", (p, v) => {
      if (!v) {
        p.discovery = null;
        return;
      }
      p.discovery = p.discovery || {};
      p.discovery.type = v;
      els["fold-discovery"].open = true;
    }],
    ["f-discovery-url", (p, v) => {
      if (!v && !p.discovery?.type) return;
      p.discovery = p.discovery || {};
      p.discovery.baseUrl = v;
    }],
  ];
  let t;
  for (const [id, apply] of providerFields) {
    els[id].addEventListener("input", () => {
      const p = state.config.providers[state.selectedProvider];
      if (!p) return;
      clearTimeout(t);
      t = setTimeout(() => {
        apply(p, els[id].value);
        markDirty();
      }, 200);
    });
  }
  els["f-strict"].addEventListener("change", () => {
    const p = state.config.providers[state.selectedProvider];
    if (!p) return;
    p.disableStrictTools = els["f-strict"].checked;
    markDirty();
  });
  els["f-discovery-type"].addEventListener("change", () => {
    const p = state.config.providers[state.selectedProvider];
    if (!p) return;
    if (els["f-discovery-type"].value) {
      p.discovery = { type: els["f-discovery-type"].value };
      els["fold-discovery"].open = true;
    } else {
      p.discovery = null;
    }
    markDirty();
  });
  els["btn-toggle-key"].addEventListener("click", () => {
    state.keyVisible = !state.keyVisible;
    els["f-apikey"].type = state.keyVisible ? "text" : "password";
  });
}

async function main() {
  bindInputs();
  els["btn-save"].addEventListener("click", save);
  els["btn-new"].addEventListener("click", async () => {
    if (state.dirty && !confirm("Discard unsaved changes?")) return;
    state.config = { providers: {} };
    state.selectedProvider = null;
    state.view = "global";
    state.selectedModel = null;
    state.dirty = false;
    renderAll();
  });
  els["btn-reload"].addEventListener("click", () => {
    if (state.dirty && !confirm("Reload and discard unsaved changes?")) return;
    load();
  });
  els["btn-add-provider"].addEventListener("click", addProvider);
  els["btn-global"].addEventListener("click", showGlobal);
  els["f-provider-name"].addEventListener("keydown", (e) => {
    if (e.key === "Enter") renameProvider(state.selectedProvider, els["f-provider-name"].value);
  });
  els["f-provider-name"].addEventListener("blur", () =>
    renameProvider(state.selectedProvider, els["f-provider-name"].value)
  );
  els["btn-test"].addEventListener("click", testConnection);
  els["btn-delete-provider"].addEventListener("click", deleteProvider);
  els["btn-add-model"].addEventListener("click", addModel);
  els["btn-add-header"].addEventListener("click", () => {
    const p = state.config.providers[state.selectedProvider];
    els["headers-rows"].appendChild(headerRow(p, "", ""));
    markDirty();
  });
  els["btn-add-override"].addEventListener("click", () => {
    const p = state.config.providers[state.selectedProvider];
    els["overrides-rows"].appendChild(overrideRow(p, "", ""));
    markDirty();
  });
  els["btn-add-equiv"].addEventListener("click", () => {
    els["equiv-rows"].appendChild(equivRow("", ""));
    markDirty();
  });
  els["btn-add-order"].addEventListener("click", () => {
    state.config.modelProviderOrder = state.config.modelProviderOrder || [];
    state.config.modelProviderOrder.push("new-provider");
    markDirty();
    renderOrder();
  });
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    }
  });

  try {
    state.constants = await invoke("get_constants");
  } catch (e) {
    toast("failed to fetch constants: " + e, "err");
  }
  await load();
}

main();

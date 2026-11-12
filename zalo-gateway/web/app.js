"use strict";
(() => {
  const $ = id => document.getElementById(id);
  let token = "", epoch = 0, selected = null, accounts = [], busy = false;
  function element(tag, value, className) {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = String(value);
    if (className) node.className = className;
    return node;
  }
  function notice(value, error = false) {
    $("notice").textContent = value;
    $("notice").classList.remove("hidden");
    $("notice").setAttribute("role", error ? "alert" : "status");
  }
  function logout() {
    token = ""; epoch++; selected = null; accounts = [];
    $("tokenInput").value = "";
    $("workspace").classList.add("hidden");
    $("authPanel").classList.remove("hidden");
    $("logoutButton").classList.add("hidden");
    for (const id of ["accountsGrid","threadList","messageList","outboxList","gapsList","healthContent"]) $(id).replaceChildren();
    $("messageText").value = ""; $("quoteSourceMessageId").value = "";
    $("newAccountId").value = ""; $("newAccountLabel").value = "";
    $("notice").textContent = "";
    composer();
  }
  async function api(path, body) {
    const version = epoch;
    const response = await fetch("/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: "Bearer " + token, ...(body === undefined ? {} : {"Content-Type":"application/json"}) },
      ...(body === undefined ? {} : {body:JSON.stringify(body)}),
      cache: "no-store"
    });
    const data = await response.json();
    if (version !== epoch) throw new Error("Session changed");
    if (response.status === 401) { logout(); throw new Error("Operator token rejected"); }
    if (!response.ok) throw new Error(data.error?.message || "Gateway request failed");
    return data;
  }
  async function action(fn) {
    if (busy || !token) return;
    busy = true;
    try { await fn(); await refresh(); }
    catch (error) { if (token) notice(error.message, true); }
    finally { busy = false; }
  }
  function button(label, fn, enabled = true) {
    const node = element("button", label, "button button-secondary button-small");
    node.type = "button"; node.disabled = !enabled;
    node.addEventListener("click", () => action(fn));
    return node;
  }
  function time(value) { return value ? new Date(value).toLocaleString() : "unknown"; }
  function empty(parent, value) { parent.replaceChildren(element("div", value, "empty-state")); }
  function composer() {
    for (const id of ["messageText","quoteSourceMessageId","createDraftButton"]) $(id).disabled = !selected;
    $("composerContext").textContent = selected ? selected.accountId + " / " + selected.threadId + " — MOCK ONLY" : "Select an account/thread before drafting.";
  }
  function renderAccounts() {
    $("accountCount").textContent = accounts.length + " / 3";
    $("addAccountButton").disabled = accounts.length >= 3;
    $("accountsGrid").replaceChildren();
    for (const account of accounts) {
      const card = element("article", undefined, "account-card");
      const header = element("div", undefined, "account-card-header");
      const identity = element("div", undefined, "account-identity");
      identity.append(element("strong", account.label), element("p", account.id, "account-details"));
      header.append(identity, element("span", account.state, "state-badge state-" + account.state));
      card.append(header, element("p", "New events since: " + time(account.collectorStartedAt), "field-hint"));
      if (account.qr) {
        const qr = element("div", undefined, "simulated-challenge");
        qr.append(element("strong", "SIMULATED — NOT A SCANNABLE ZALO QR", "challenge-label"),
          element("p", account.qr.challengeId, "challenge-code"),
          element("p", "Expires: " + time(account.qr.expiresAt), "challenge-expiry"));
        card.append(qr);
      }
      const controls = element("div", undefined, "account-controls");
      const endpoint = "accounts/" + encodeURIComponent(account.id) + "/";
      controls.append(
        button("Simulate QR", () => api(endpoint + "login", {}), !["connected","authenticating","reconnecting"].includes(account.state)),
        button("Confirm simulated QR", () => api(endpoint + "connect", {challengeId:account.qr?.challengeId}), !!account.qr),
        button("Network loss", () => api(endpoint + "disconnect", {reason:"network_loss"}), account.state === "connected"),
        button("Reconnect", () => api(endpoint + "reconnect", {}), ["reconnecting","degraded"].includes(account.state)),
        button("Expire session", () => api(endpoint + "expire", {}))
      );
      const fixtures = element("div", undefined, "fixture-buttons");
      for (const scenario of ["standard","burst","duplicate"]) fixtures.append(button("Mock " + scenario, async () => {
        const result = await api(endpoint + "fixtures", {scenario, ...(scenario === "burst" ? {count:30} : {})});
        notice("Synthetic events accepted: " + result.accepted + "; duplicates: " + result.duplicates);
      }, account.state === "connected"));
      card.append(controls, fixtures); $("accountsGrid").append(card);
    }
    const filter = $("inboxAccountFilter"), previous = filter.value;
    filter.replaceChildren(element("option", "All authorized accounts"));
    filter.firstChild.value = "all";
    for (const account of accounts) {const option = element("option", account.label + " / " + account.id);option.value = account.id;filter.append(option);}
    filter.value = accounts.some(a => a.id === previous) ? previous : "all";
  }
  async function messages() {
    const selection = selected, version = epoch;
    if (!selection) { empty($("messageList"), "No conversation selected."); composer(); return; }
    const key = selection.accountId + "/" + selection.threadId;
    const data = await api("messages?" + new URLSearchParams({accountId:selection.accountId,threadId:selection.threadId}));
    if (version !== epoch || !selected || selected.accountId + "/" + selected.threadId !== key) return;
    $("conversationHeader").replaceChildren(element("h3", selection.label), element("p", key + " · latest 200 captured messages"));
    $("messageList").replaceChildren();
    for (const message of data.messages) {
      const row = element("article", undefined, "message-row message-" + message.direction);
      const bubble = element("div", undefined, "message-bubble");
      bubble.append(element("p", message.accountId + " / " + message.threadId + " · " + message.direction + " · " + message.eventKind, "message-meta"),
        element("p", message.recalled ? "[Recalled — content unavailable]" : message.content, "message-content"),
        element("p", "Source " + time(message.sourceTimestamp) + " · received " + time(message.receivedAt) + " · " + message.sourceMessageId + " · v" + message.version, "message-footer"));
      if (message.quoteSourceMessageId) bubble.append(element("p", "Quoted: " + message.quoteSourceMessageId, "message-footer"));
      row.append(bubble); $("messageList").append(row);
    }
    if (!data.messages.length) empty($("messageList"), "No captured messages.");
    composer();
  }
  function renderOutbox(items) {
    $("outboxList").replaceChildren();
    for (const item of items) {
      const card = element("article", undefined, "compact-item");
      card.append(element("strong", item.accountId + " / " + item.threadId),
        element("p", item.text), element("p", "MOCK · " + item.state + " · " + time(item.updatedAt), "outbox-state outbox-" + item.state));
      if (item.quoteSourceMessageId) card.append(element("p", "Quote: " + item.quoteSourceMessageId));
      if (item.error) card.append(element("p", item.error, "outbox-error"));
      if (item.state === "draft") {
        const label = element("label");
        const checkbox = element("input"); checkbox.type = "checkbox";
        label.append(checkbox, document.createTextNode(" I confirm this exact mock account, thread and message."));
        const confirm = button("Confirm mock send", async () => {
          if (!checkbox.checked || !selected || selected.accountId !== item.accountId || selected.threadId !== item.threadId) throw new Error("Select this exact account/thread and tick confirmation.");
          if (!window.confirm("MOCK SEND ONLY\n" + item.accountId + " / " + item.threadId + "\n" + item.text)) return;
          await api("outbox/" + encodeURIComponent(item.id) + "/confirm", {accountId:item.accountId,threadId:item.threadId,operatorConfirmed:true});
        }, false);
        checkbox.addEventListener("change", () => {confirm.disabled = !checkbox.checked || !selected || selected.accountId !== item.accountId || selected.threadId !== item.threadId;});
        card.append(label, confirm);
      }
      $("outboxList").append(card);
    }
    if (!items.length) empty($("outboxList"), "No mock drafts.");
  }
  let refreshPromise;
  function refresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const version = epoch, filterValue = $("inboxAccountFilter").value;
      const query = filterValue === "all" ? "" : "?" + new URLSearchParams({accountId:filterValue});
      const [health, accountData, inbox, gaps, outbox] = await Promise.all([
        api("health"), api("accounts"), api("inbox" + query), api("gaps" + query), api("outbox" + query)
      ]);
      if (version !== epoch || filterValue !== $("inboxAccountFilter").value) return;
      accounts = accountData.accounts; renderAccounts();
      $("healthContent").replaceChildren();
      for (const [label,value] of [["Mode","MOCK"],["Accounts",health.accounts],["Queued",health.queue?.pending ?? "restricted"],["Real login/send","DISABLED"]]) {
        const cell = element("div", undefined, "health-item");
        cell.append(element("span", label), element("strong", value)); $("healthContent").append(cell);
      }
      $("threadCount").textContent = inbox.threads.length;
      $("threadList").replaceChildren();
      for (const thread of inbox.threads) {
        const node = button(thread.label, async () => {selected = thread; await messages();});
        node.className = "thread-item" + (selected?.accountId === thread.accountId && selected?.threadId === thread.threadId ? " is-selected" : "");
        node.append(element("p", thread.accountId + " / " + thread.threadId, "thread-provenance"),
          element("p", thread.threadType + (thread.muted ? " · muted fixture metadata" : "") + " · " + thread.messageCount + " messages", "thread-type"),
          element("p", time(thread.lastMessageAt), "thread-time"));
        $("threadList").append(node);
      }
      if (!inbox.threads.length) empty($("threadList"), "No synthetic events yet. Connect a mock account and emit a fixture.");
      if (selected && !inbox.threads.some(t => t.accountId === selected.accountId && t.threadId === selected.threadId)) selected = null;
      $("gapsList").replaceChildren();
      for (const gap of gaps.gaps) {
        const item = element("article", undefined, "compact-item");
        item.append(element("strong", gap.accountId + " · COVERAGE UNKNOWN"),
          element("p", time(gap.startedAt) + " → " + time(gap.endedAt)),
          element("p", gap.reason + " — no history fetched; missed messages cannot be counted."));
        $("gapsList").append(item);
      }
      if (!gaps.gaps.length) empty($("gapsList"), "No recorded disconnect gaps. This does not prove source coverage.");
      renderOutbox(outbox.outbox);
      await messages();
      $("syncStatus").textContent = "Updated " + new Date().toLocaleTimeString();
    })().finally(() => { refreshPromise = undefined; });
    return refreshPromise;
  }
  $("authForm").addEventListener("submit", async event => {
    event.preventDefault(); epoch++; token = $("tokenInput").value.trim(); $("tokenInput").value = "";
    try {
      await api("health");
      $("authPanel").classList.add("hidden"); $("workspace").classList.remove("hidden"); $("logoutButton").classList.remove("hidden");
      $("authError").textContent = ""; await refresh();
    } catch (error) { logout(); $("authError").textContent = error.message; }
  });
  $("logoutButton").addEventListener("click", logout);
  $("refreshButton").addEventListener("click", () => action(async () => {}));
  $("accountForm").addEventListener("submit", event => {
    event.preventDefault(); action(async () => {
      await api("accounts", {id:$("newAccountId").value.trim(),label:$("newAccountLabel").value.trim()});
      $("accountForm").reset();
    });
  });
  $("inboxAccountFilter").addEventListener("change", () => {
    selected = null; composer();
    if (refreshPromise) refreshPromise.finally(() => action(async () => {})).catch(() => {});
    else action(async () => {});
  });
  $("composerForm").addEventListener("submit", event => {
    event.preventDefault(); action(async () => {
      if (!selected) throw new Error("Select an account/thread.");
      const quote = $("quoteSourceMessageId").value.trim();
      await api("outbox", {accountId:selected.accountId,threadId:selected.threadId,text:$("messageText").value,intentId:"mock-ui-" + crypto.randomUUID(),...(quote ? {quoteSourceMessageId:quote} : {})});
      $("messageText").value = ""; $("quoteSourceMessageId").value = "";
      notice("Mock draft created. Review it below and explicitly confirm. Nothing was sent.");
    });
  });
  setInterval(() => { if (token && !busy) refresh().catch(error => {if (token) notice(error.message,true);}); }, 5000);
})();

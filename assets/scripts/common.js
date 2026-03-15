(() => {
  "use strict";

  const safe = (fn, fallback = undefined) => {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  };

  const replaceTo = (url) => {
    try {
      window.location.replace(url);
    } catch {
      window.location.href = url;
    }
  };

  const openTab = (url) => {
    try {
      const w = window.open(url, "_blank");
      if (w) {
        try { w.opener = null; } catch {}
      }
      return w || null;
    } catch {
      return null;
    }
  };

  const curUrl = new URL(window.location.href);
  const getSP = (key, def = "") => curUrl.searchParams.get(key) ?? def;

  const CLONE_PARAM = "__cl";
  const FAST_PARAM = "__fast";
  const MICRO_DONE_KEY = "__micro_done";
  const REVERSE_STATE_KEY = "__rev_player";

  const isClone = getSP(CLONE_PARAM) === "1";

  if (isClone) {
    document.documentElement.classList.add("clone-mode");
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        document.body.classList.add("clone-mode");
      }, { once: true });
    } else if (document.body) {
      document.body.classList.add("clone-mode");
    }
  }

  const IN = {
    pz: getSP("pz"),
    tb: getSP("tb"),
    tb_reverse: getSP("tb_reverse"),
    ae: getSP("ae"),
    z: getSP("z"),
    var: getSP("var"),
    var_1: getSP("var_1"),
    var_2: getSP("var_2"),
    var_3: getSP("var_3"),
    b: getSP("b"),
    campaignid: getSP("campaignid"),
    abtest: getSP("abtest"),
    rhd: getSP("rhd", "1"),
    s: getSP("s"),
    ymid: getSP("ymid"),
    wua: getSP("wua"),
    use_full_list_or_browsers: getSP("use_full_list_or_browsers"),
    cid: getSP("cid"),
    geo: getSP("geo"),
    external_id: getSP("external_id"),
    creative_id: getSP("creative_id"),
    ad_campaign_id: getSP("ad_campaign_id"),
    cost: getSP("cost")
  };

  const getTimezoneName = () => safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone, "") || "";
  const getTimezoneOffset = () => safe(() => new Date().getTimezoneOffset(), 0);

  let osVersionCached = "";
  safe(async () => {
    const nav = navigator;
    if (!nav.userAgentData?.getHighEntropyValues) return;
    const values = await nav.userAgentData.getHighEntropyValues(["platformVersion"]);
    osVersionCached = values?.platformVersion || "";
  });

  const buildCmeta = () => {
    const html = document.documentElement;
    const payload = {
      dataVer: html.getAttribute("data-version") || html.dataset.version || "",
      landingName: html.getAttribute("data-landing-name") || html.dataset.landingName || "",
      templateHash: window.templateHash || ""
    };
    return safe(() => btoa(JSON.stringify(payload)), "");
  };

  const qsFromObj = (obj) => {
    const qs = new URLSearchParams();
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (v != null && String(v) !== "") qs.set(k, String(v));
    });
    return qs;
  };

  const normalizeConfig = (appCfg) => {
    if (!appCfg || typeof appCfg !== "object" || !appCfg.domain) return null;

    const cfg = { domain: appCfg.domain };
    const ensure = (name) => (cfg[name] ||= {});

    Object.entries(appCfg).forEach(([key, value]) => {
      if (value == null || value === "" || key === "domain") return;

      let m = key.match(/^([a-zA-Z0-9]+)_(currentTab|newTab)_(zoneId|url)$/);
      if (m) {
        const [, name, tab, field] = m;
        const ex = ensure(name);
        (ex[tab] ||= {}).domain = field === "zoneId" ? cfg.domain : ex[tab].domain;
        ex[tab][field] = value;
        return;
      }

      m = key.match(/^([a-zA-Z0-9]+)_(count|timeToRedirect|pageUrl)$/);
      if (m) {
        ensure(m[1])[m[2]] = value;
        return;
      }

      m = key.match(/^([a-zA-Z0-9]+)_(zoneId|url)$/);
      if (m) {
        const [, name, field] = m;
        const ex = ensure(name);
        const tab = name === "tabUnderClick" ? "newTab" : "currentTab";
        (ex[tab] ||= {}).domain = field === "zoneId" ? cfg.domain : ex[tab].domain;
        ex[tab][field] = value;
      }
    });

    return cfg;
  };

  const buildExitQS = ({ zoneId }) => {
    const ab2r = IN.abtest || (typeof window.APP_CONFIG?.abtest !== "undefined" ? String(window.APP_CONFIG.abtest) : "");
    const base = {
      ymid: IN.var_1 || IN.var || "",
      var: IN.var_2 || IN.z || "",
      var_3: IN.var_3 || "",
      b: IN.b || "",
      campaignid: IN.campaignid || "",
      click_id: IN.s || "",
      rhd: IN.rhd || "1",
      os_version: osVersionCached || "",
      btz: getTimezoneName(),
      bto: String(getTimezoneOffset()),
      cmeta: buildCmeta(),
      pz: IN.pz || "",
      tb: IN.tb || "",
      tb_reverse: IN.tb_reverse || "",
      ae: IN.ae || "",
      ab2r,
      external_id: IN.external_id || "",
      creative_id: IN.creative_id || "",
      ad_campaign_id: IN.ad_campaign_id || "",
      cost: IN.cost || ""
    };

    if (zoneId != null && String(zoneId) !== "") base.zoneid = String(zoneId);
    return qsFromObj(base);
  };

  const generateAfuUrl = (zoneId, domain) => {
    const host = String(domain || "").trim();
    if (!host) return "";
    const base = host.startsWith("http") ? host : `https://${host}`;
    const url = new URL(base.replace(/\/+$/, "") + "/afu.php");
    url.search = buildExitQS({ zoneId }).toString();
    return url.toString();
  };

  const buildDirectUrlWithTracking = (baseUrl) => {
    try {
      const u = new URL(String(baseUrl), window.location.href);

      for (const [k, v] of curUrl.searchParams.entries()) {
        if (!u.searchParams.has(k) && v != null && String(v) !== "") {
          u.searchParams.set(k, v);
        }
      }

      const external_id = IN.external_id || "";
      const ad_campaign_id = IN.ad_campaign_id || IN.var_2 || "";
      const creative_id = IN.creative_id || "";
      const cost = IN.cost || IN.b || "";

      if (cost) u.searchParams.set("cost", cost);
      if (!u.searchParams.has("currency")) u.searchParams.set("currency", "usd");
      if (external_id) u.searchParams.set("external_id", external_id);
      if (creative_id) u.searchParams.set("creative_id", creative_id);
      if (ad_campaign_id) u.searchParams.set("ad_campaign_id", ad_campaign_id);

      return u.toString();
    } catch {
      return String(baseUrl || "");
    }
  };

  const resolveExitUrl = (ex, cfg) => {
    if (!ex) return "";
    if (ex.url) return buildDirectUrlWithTracking(ex.url);
    if (ex.zoneId && (ex.domain || cfg?.domain)) {
      return generateAfuUrl(ex.zoneId, ex.domain || cfg.domain);
    }
    return "";
  };

  const pushBackStates = (url, count) => {
    const n = Math.max(0, parseInt(count, 10) || 0);
    const originalUrl = window.location.href;

    for (let i = 0; i < n; i += 1) {
      window.history.pushState(null, "Please wait...", url);
    }
    window.history.pushState(null, document.title, originalUrl);
  };

  const getDefaultBackHtmlUrl = () => {
    const { origin, pathname } = window.location;
    let dir = pathname.replace(/\/(index|back)\.html$/i, "");
    if (dir.endsWith("/")) dir = dir.slice(0, -1);
    return dir ? `${origin}${dir}/back.html` : `${origin}/back.html`;
  };

  const initBack = (cfg) => {
    const back = cfg?.back?.currentTab;
    if (!back) return;

    const count = cfg.back?.count ?? 10;
    const pageUrl = cfg.back?.pageUrl || getDefaultBackHtmlUrl();
    const page = new URL(pageUrl, window.location.href);
    const qs = buildExitQS({ zoneId: back.zoneId });

    if (back.url) {
      qs.set("url", String(back.url));
    } else {
      qs.set("z", String(back.zoneId));
      qs.set("domain", String(back.domain || cfg.domain || ""));
    }

    page.search = qs.toString();
    pushBackStates(page.toString(), count);
  };

  const logExitMetric = (eventName, ex) => {
    safe(() => window.syncMetric?.({
      event: eventName,
      exitZoneId: ex?.zoneId || ex?.url
    }));
  };

  const runExitCurrentTab = (cfg, name, withBack = true) => {
    const ex = cfg?.[name]?.currentTab;
    if (!ex) return false;

    const url = resolveExitUrl(ex, cfg);
    if (!url) return false;

    logExitMetric(name, ex);

    if (withBack) initBack(cfg);
    setTimeout(() => replaceTo(url), withBack ? 40 : 0);
    return true;
  };

  const runExitDualTabs = (cfg, name, withBack = true) => {
    const ex = cfg?.[name];
    if (!ex) return false;

    const currentTab = ex.currentTab;
    const newTab = ex.newTab;

    const currentTabUrl = resolveExitUrl(currentTab, cfg);
    const newTabUrl = resolveExitUrl(newTab, cfg);

    if (!currentTabUrl && !newTabUrl) return false;

    if (currentTabUrl) logExitMetric(name, currentTab);
    if (newTabUrl) logExitMetric(name, newTab);

    if (withBack) initBack(cfg);
    if (newTabUrl) openTab(newTabUrl);
    if (currentTabUrl) setTimeout(() => replaceTo(currentTabUrl), withBack ? 40 : 0);

    return true;
  };

  const run = (cfg, name) => {
    if (cfg?.[name]?.newTab) return runExitDualTabs(cfg, name, true);
    return runExitCurrentTab(cfg, name, true);
  };

  const isPlayerReady = () => {
    const btn = document.querySelector(".xh-main-play-trigger");
    return !!(btn && btn.classList.contains("ready"));
  };

  const buildCloneUrl = (fast) => {
    const u = new URL(window.location.href);
    u.searchParams.set(CLONE_PARAM, "1");

    if (fast) u.searchParams.set(FAST_PARAM, "1");
    else u.searchParams.delete(FAST_PARAM);

    const video = document.querySelector("video");
    const imgFrame = document.querySelector(".xh-frame");

    if (video) {
      u.searchParams.set("t", String(video.currentTime || 0));
      const poster = video.getAttribute("poster");
      if (poster) u.searchParams.set("__poster", poster);
    } else if (imgFrame?.src) {
      u.searchParams.set("t", "0");
      u.searchParams.set("__poster", imgFrame.src);
    }

    return u.toString();
  };

  const runMicroHandoff = (cfg, fast) => {
    if (isClone) return false;

    if (safe(() => sessionStorage.getItem(MICRO_DONE_KEY), "") === "1") {
      return run(cfg, "mainExit");
    }

    safe(() => sessionStorage.setItem(MICRO_DONE_KEY, "1"));

    const cloneUrl = buildCloneUrl(!!fast);
    safe(() => window.syncMetric?.({ event: fast ? "micro_handoff_fast" : "micro_handoff_slow" }));

    openTab(cloneUrl);

    const donorExit = cfg?.autoexit?.currentTab || cfg?.autoexit?.newTab;
    const donorUrl = resolveExitUrl(donorExit, cfg);

    if (donorUrl) {
      logExitMetric("autoexit", donorExit);
      initBack(cfg);
      setTimeout(() => replaceTo(donorUrl), 40);
      return true;
    }

    return run(cfg, "mainExit");
  };

  const initReverse = (cfg) => {
    if (!cfg?.reverse?.currentTab) return;

    safe(() => window.history.pushState({ [REVERSE_STATE_KEY]: 1 }, "", window.location.href));
    window.addEventListener("popstate", (e) => {
      if (e?.state && e.state[REVERSE_STATE_KEY] === 1) {
        runExitCurrentTab(cfg, "reverse", false);
      }
    });
  };

  const initAutoexit = (cfg) => {
    if (!cfg?.autoexit?.currentTab) return;

    const sec = parseInt(cfg.autoexit.timeToRedirect, 10) || 90;
    let armed = false;

    const trigger = () => {
      if (document.visibilityState === "visible" && armed) {
        runExitCurrentTab(cfg, "autoexit", true);
      }
    };

    const timer = setTimeout(() => {
      armed = true;
      trigger();
    }, sec * 1000);

    const cancel = () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", trigger);
    };

    document.addEventListener("visibilitychange", trigger);
    ["mousemove", "click", "scroll"].forEach((ev) => {
      document.addEventListener(ev, cancel, { once: true });
    });
  };

  const initClickMap = (cfg) => {
    const fired = { mainExit: false };
    const microTargets = new Set([
      "timeline",
      "play_pause",
      "mute_unmute",
      "settings",
      "fullscreen",
      "pip_top",
      "pip_bottom"
    ]);

    document.addEventListener("click", (e) => {
      const zone = e.target?.closest?.("[data-target]");
      const target = zone?.getAttribute("data-target") || "";
      const modal = document.getElementById("xh_exit_modal");

      if (target === "main_play") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (isClone) {
          if (fired.mainExit) return;
          fired.mainExit = true;
          run(cfg, "mainExit");
          return;
        }

        runMicroHandoff(cfg, false);
        return;
      }

      if (target === "banner_main") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        run(cfg, "mainExit");
        return;
      }

      if (target === "back_button") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (modal) {
          modal.style.display = "flex";
          modal.setAttribute("aria-hidden", "false");
        }
        return;
      }

      if (target === "modal_stay") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (modal) {
          modal.style.display = "none";
          modal.setAttribute("aria-hidden", "true");
        }

        runMicroHandoff(cfg, false);
        return;
      }

      if (target === "modal_leave") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (modal) {
          modal.style.display = "none";
          modal.setAttribute("aria-hidden", "true");
        }

        run(cfg, "ageExit");
        return;
      }

      if (isClone) {
        if (fired.mainExit) return;
        fired.mainExit = true;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        run(cfg, "mainExit");
        return;
      }

      if (microTargets.has(target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        runMicroHandoff(cfg, true);
        return;
      }

      if (fired.mainExit) return;
      fired.mainExit = true;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      run(cfg, "mainExit");
    }, true);
  };

  const boot = () => {
    if (typeof window.APP_CONFIG === "undefined") {
      document.body.innerHTML = "<p style='color:#fff;padding:12px'>MISSING APP_CONFIG</p>";
      return;
    }

    const cfg = normalizeConfig(window.APP_CONFIG);
    if (!cfg) return;

    window.LANDING_EXITS = {
      cfg,
      run: (name) => run(cfg, name),
      initBack: () => initBack(cfg),
      microHandoff: (fast) => runMicroHandoff(cfg, fast),
      isPlayerReady
    };

    initClickMap(cfg);
    initAutoexit(cfg);
    initReverse(cfg);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

import { parse } from "parse5";
import { digestObject, sha256 } from "./hash.js";
import { getOrigin, sanitizeUrl, selectSecurityHeaders } from "./privacy.js";
import { ENGINE_VERSION } from "./version.js";
import { assertDocumentReady, CaptureReadinessError, readinessEvidence } from "./readiness.js";

function isHttpOrigin(origin) {
  return origin.startsWith("http://") || origin.startsWith("https://");
}

function allowedNavigationOrigins(config) {
  return config.authorization.allowed_navigation_origins ?? [getOrigin(config.url)];
}

function navigationOriginAllowed(config, rawUrl) {
  return allowedNavigationOrigins(config).includes(getOrigin(rawUrl));
}

function privacySafeErrorMessage(error, rawUrl) {
  const original = String(error?.message ?? error?.name ?? "Request failed");
  return original.replaceAll(String(rawUrl), sanitizeUrl(rawUrl)).slice(0, 500);
}

function collectNetworkOrigin(originMap, request) {
  const origin = getOrigin(request.url());
  if (!isHttpOrigin(origin)) {
    return;
  }

  const existing = originMap.get(origin) ?? {
    origin,
    request_count: 0,
    resource_types: new Set(),
  };
  existing.request_count += 1;
  existing.resource_types.add(request.resourceType());
  originMap.set(origin, existing);
}

async function captureScriptResponse(response, responseMap, warnings) {
  if (response.request().resourceType() !== "script") {
    return;
  }

  try {
    const body = await response.body();
    responseMap.set(response.url(), {
      content_sha256: sha256(body),
      content_bytes: body.byteLength,
      response_status: response.status(),
      response_content_type: response.headers()["content-type"] ?? null,
    });
  } catch (error) {
    warnings.push({
      code: "SCRIPT_BODY_UNAVAILABLE",
      url: sanitizeUrl(response.url()),
      message: privacySafeErrorMessage(error, response.url()),
    });
  }
}

function summarizeOrigins(originMap, firstPartyOrigin) {
  return [...originMap.values()]
    .map((entry) => ({
      origin: entry.origin,
      first_party: entry.origin === firstPartyOrigin,
      request_count: entry.request_count,
      resource_types: [...entry.resource_types].sort(),
    }))
    .sort((left, right) => left.origin.localeCompare(right.origin));
}

async function scanWithBrowser(config, options = {}) {
  const warnings = [];
  const networkOrigins = new Map();
  const scriptResponses = new Map();
  const responseTasks = [];
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: !options.headed });

  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: false,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    let blockedNavigationOrigin = null;
    let latestDocumentResponse = null;

    await page.route("**/*", async (route) => {
      const request = route.request();
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame() &&
        !navigationOriginAllowed(config, request.url())
      ) {
        blockedNavigationOrigin = getOrigin(request.url());
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    page.on("request", (request) => collectNetworkOrigin(networkOrigins, request));
    page.on("response", (response) => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) {
        latestDocumentResponse = response;
      }
      responseTasks.push(captureScriptResponse(response, scriptResponses, warnings));
    });

    let mainResponse;
    try {
      mainResponse = await page.goto(config.url, {
        waitUntil: config.scan.wait_until,
        timeout: config.scan.timeout_ms,
      });
    } catch (error) {
      if (blockedNavigationOrigin) {
        throw new Error(`Main navigation left the authorized origins and was blocked: ${blockedNavigationOrigin}`);
      }
      throw new CaptureReadinessError("CAPTURE_NAVIGATION_FAILED", "Navigation failed or timed out. No successful capture was produced.");
    }

    if (!mainResponse) {
      throw new Error("Navigation completed without a main document response");
    }
    assertDocumentReady(config, mainResponse.status(), page.url());

    const markerId = config.capture_expectations?.ready_element_id;
    if (markerId) {
      try {
        await page.locator(`#${markerId}`).waitFor({ state: "visible", timeout: config.scan.timeout_ms });
      } catch {
        throw new CaptureReadinessError("CAPTURE_MARKER_MISSING", "The configured page-ready element did not become visible before timeout.");
      }
    }

    if (config.scan.post_load_wait_ms > 0) {
      await page.waitForTimeout(config.scan.post_load_wait_ms);
    }
    await Promise.allSettled(responseTasks);

    const finalRawUrl = page.url();
    if (blockedNavigationOrigin || !navigationOriginAllowed(config, finalRawUrl)) {
      throw new Error(`Main navigation left the authorized origins: ${getOrigin(finalRawUrl)}`);
    }
    const documentResponse = latestDocumentResponse ?? mainResponse;
    assertDocumentReady(config, documentResponse.status(), finalRawUrl);
    if (markerId && !await page.locator(`#${markerId}`).isVisible()) {
      throw new CaptureReadinessError("CAPTURE_MARKER_MISSING", "The page-ready element disappeared before capture.");
    }
    const firstPartyOrigin = getOrigin(finalRawUrl);
    const domScripts = await page.locator("script").evaluateAll((nodes) =>
      nodes.map((node, domIndex) => ({
        dom_index: domIndex,
        src: node.src || null,
        type: node.type || "text/javascript",
        async: node.async,
        defer: node.defer,
        integrity: node.integrity || null,
        crossorigin: node.crossOrigin || null,
        referrerpolicy: node.referrerPolicy || null,
        nonce_present: Boolean(node.nonce),
        inline_text: node.src ? null : node.textContent ?? "",
      })),
    );

    const scripts = domScripts.map((script) => {
      if (script.src) {
        const responseEvidence = scriptResponses.get(script.src) ?? {};
        const sanitizedSource = sanitizeUrl(script.src);
        return {
          dom_index: script.dom_index,
          kind: "external",
          src: sanitizedSource,
          src_sha256: sha256(sanitizedSource),
          origin: getOrigin(script.src),
          first_party: getOrigin(script.src) === firstPartyOrigin,
          type: script.type,
          async: script.async,
          defer: script.defer,
          integrity: script.integrity,
          crossorigin: script.crossorigin,
          referrerpolicy: script.referrerpolicy,
          nonce_present: script.nonce_present,
          content_sha256: responseEvidence.content_sha256 ?? null,
          content_bytes: responseEvidence.content_bytes ?? null,
          response_status: responseEvidence.response_status ?? null,
          response_content_type: responseEvidence.response_content_type ?? null,
        };
      }

      return {
        dom_index: script.dom_index,
        kind: "inline",
        src: null,
        src_sha256: null,
        origin: firstPartyOrigin,
        first_party: true,
        type: script.type,
        async: script.async,
        defer: script.defer,
        integrity: script.integrity,
        crossorigin: script.crossorigin,
        referrerpolicy: script.referrerpolicy,
        nonce_present: script.nonce_present,
        content_sha256: sha256(script.inline_text),
        content_bytes: Buffer.byteLength(script.inline_text, "utf8"),
        response_status: null,
        response_content_type: null,
      };
    });

    const renderedHtml = await page.content();
    const snapshot = {
      schema_version: "1.0",
      engine: {
        name: "checkout-evidence-engine",
        version: ENGINE_VERSION,
        capture_mode: "browser",
        behavior: "GET navigation and passive resource observation only",
      },
      captured_at: new Date().toISOString(),
      target: {
        target_id: config.target_id,
        name: config.name,
        requested_url: sanitizeUrl(config.url),
        requested_url_sha256: sha256(sanitizeUrl(config.url)),
        authorization: {
          confirmed: true,
          confirmed_by: config.authorization.confirmed_by,
          confirmed_at: config.authorization.confirmed_at,
          scope_note: config.authorization.scope_note,
          allowed_navigation_origins: allowedNavigationOrigins(config),
        },
      },
      page: {
        final_url: sanitizeUrl(finalRawUrl),
        final_url_sha256: sha256(sanitizeUrl(finalRawUrl)),
        title: await page.title(),
        http_status: documentResponse.status(),
        readiness: readinessEvidence(config, markerId ? "VISIBLE" : "NOT_CONFIGURED"),
        rendered_dom_sha256: sha256(renderedHtml),
        security_headers: selectSecurityHeaders(documentResponse.headers()),
      },
      scripts,
      network_origins: summarizeOrigins(networkOrigins, firstPartyOrigin),
      warnings,
      privacy: {
        response_bodies_stored: false,
        inline_script_content_stored: false,
        query_values_stored: false,
        cookies_stored: false,
        form_values_collected: false,
      },
    };

    snapshot.snapshot_sha256 = digestObject(snapshot);
    return snapshot;
  } finally {
    await browser.close();
  }
}

function addObservedOrigin(originMap, rawUrl, resourceType) {
  const origin = getOrigin(rawUrl);
  if (!isHttpOrigin(origin)) {
    return;
  }
  const existing = originMap.get(origin) ?? {
    origin,
    request_count: 0,
    resource_types: new Set(),
  };
  existing.request_count += 1;
  existing.resource_types.add(resourceType);
  originMap.set(origin, existing);
}

function findElements(node, tagName, matches = []) {
  if (node.tagName === tagName) {
    matches.push(node);
  }
  for (const child of node.childNodes ?? []) {
    findElements(child, tagName, matches);
  }
  return matches;
}

function attributes(node) {
  return Object.fromEntries((node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]));
}

function hasElementId(node, id) {
  return (node.tagName && attributes(node).id === id) ||
    (node.childNodes ?? []).some((child) => hasElementId(child, id));
}

function nodeText(node) {
  return (node.childNodes ?? [])
    .map((child) => (child.nodeName === "#text" ? child.value : nodeText(child)))
    .join("");
}

async function readLimitedBody(response, limitBytes) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limitBytes) {
    throw new Error(`Response exceeds ${limitBytes} byte safety limit`);
  }
  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limitBytes) {
      await reader.cancel();
      throw new Error(`Response exceeds ${limitBytes} byte safety limit`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function safeFetch(rawUrl, timeoutMs, redirect = "follow") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(rawUrl, {
      method: "GET",
      redirect,
      signal: controller.signal,
      headers: {
        "user-agent": "CheckoutEvidenceEngine/0.1 (authorized passive evidence collection)",
        accept: "text/html,application/javascript,text/javascript,*/*;q=0.1",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAuthorizedDocument(config) {
  let currentUrl = config.url;
  for (let redirectCount = 0; redirectCount <= 10; redirectCount += 1) {
    if (!navigationOriginAllowed(config, currentUrl)) {
      throw new Error(`Main navigation left the authorized origins: ${getOrigin(currentUrl)}`);
    }
    const response = await safeFetch(currentUrl, config.scan.timeout_ms, "manual");
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    currentUrl = new URL(location, currentUrl).href;
  }
  throw new Error("Main navigation exceeded the 10-redirect safety limit");
}

async function captureStaticScript(script, config, originMap, warnings, firstPartyOrigin) {
  const sanitizedSource = script.src ? sanitizeUrl(script.src) : null;
  const common = {
    dom_index: script.dom_index,
    kind: script.src ? "external" : "inline",
    src: sanitizedSource,
    src_sha256: sanitizedSource ? sha256(sanitizedSource) : null,
    origin: script.src ? getOrigin(script.src) : firstPartyOrigin,
    first_party: script.src ? getOrigin(script.src) === firstPartyOrigin : true,
    type: script.type,
    async: script.async,
    defer: script.defer,
    integrity: script.integrity,
    crossorigin: script.crossorigin,
    referrerpolicy: script.referrerpolicy,
    nonce_present: script.nonce_present,
  };

  if (!script.src) {
    return {
      ...common,
      content_sha256: sha256(script.inline_text),
      content_bytes: Buffer.byteLength(script.inline_text, "utf8"),
      response_status: null,
      response_content_type: null,
    };
  }

  if (!script.src.startsWith("http://") && !script.src.startsWith("https://")) {
    warnings.push({
      code: "UNSUPPORTED_SCRIPT_URL",
      url: sanitizeUrl(script.src),
      message: "Static mode fetches only HTTP(S) script URLs",
    });
    return {
      ...common,
      content_sha256: null,
      content_bytes: null,
      response_status: null,
      response_content_type: null,
    };
  }

  addObservedOrigin(originMap, script.src, "script");
  try {
    const response = await safeFetch(script.src, config.scan.timeout_ms);
    const body = await readLimitedBody(response, 5 * 1024 * 1024);
    return {
      ...common,
      content_sha256: sha256(body),
      content_bytes: body.byteLength,
      response_status: response.status,
      response_content_type: response.headers.get("content-type"),
    };
  } catch (error) {
    warnings.push({
      code: "SCRIPT_FETCH_FAILED",
      url: sanitizeUrl(script.src),
      message: privacySafeErrorMessage(error, script.src),
    });
    return {
      ...common,
      content_sha256: null,
      content_bytes: null,
      response_status: null,
      response_content_type: null,
    };
  }
}

async function scanWithStaticFetch(config) {
  const warnings = [
    {
      code: "STATIC_MODE_LIMITATION",
      message: "JavaScript was not executed; runtime-injected scripts and requests are outside this snapshot",
    },
  ];
  const networkOrigins = new Map();
  addObservedOrigin(networkOrigins, config.url, "document");

  const mainResponse = await fetchAuthorizedDocument(config);
  assertDocumentReady(config, mainResponse.status, mainResponse.url);
  const htmlBuffer = await readLimitedBody(mainResponse, 5 * 1024 * 1024);
  const html = htmlBuffer.toString("utf8");
  const document = parse(html);
  const markerId = config.capture_expectations?.ready_element_id;
  if (markerId && !hasElementId(document, markerId)) {
    throw new CaptureReadinessError("CAPTURE_MARKER_MISSING", "The configured page-ready element is absent from the received HTML. Use browser mode for a JavaScript-rendered marker.");
  }
  const finalRawUrl = mainResponse.url;
  const firstPartyOrigin = getOrigin(finalRawUrl);
  if (getOrigin(config.url) !== firstPartyOrigin) {
    addObservedOrigin(networkOrigins, finalRawUrl, "document-redirect");
  }

  const scriptNodes = findElements(document, "script");
  if (scriptNodes.length > 100) {
    throw new Error("Refusing to fetch more than 100 declared scripts in one static scan");
  }

  const declaredScripts = scriptNodes.map((node, domIndex) => {
    const attrs = attributes(node);
    let resolvedSource = null;
    if (attrs.src) {
      try {
        resolvedSource = new URL(attrs.src, finalRawUrl).href;
      } catch {
        resolvedSource = attrs.src;
      }
    }
    return {
      dom_index: domIndex,
      src: resolvedSource,
      type: attrs.type || "text/javascript",
      async: Object.hasOwn(attrs, "async"),
      defer: Object.hasOwn(attrs, "defer"),
      integrity: attrs.integrity || null,
      crossorigin: attrs.crossorigin || null,
      referrerpolicy: attrs.referrerpolicy || null,
      nonce_present: Object.hasOwn(attrs, "nonce"),
      inline_text: resolvedSource ? null : nodeText(node),
    };
  });

  const scripts = [];
  for (const script of declaredScripts) {
    scripts.push(await captureStaticScript(script, config, networkOrigins, warnings, firstPartyOrigin));
  }

  const titleNode = findElements(document, "title")[0];
  const snapshot = {
    schema_version: "1.0",
    engine: {
      name: "checkout-evidence-engine",
      version: ENGINE_VERSION,
      capture_mode: "static",
      behavior: "Authorized HTML GET plus passive GETs for script elements declared in that HTML; no JavaScript execution",
    },
    captured_at: new Date().toISOString(),
    target: {
      target_id: config.target_id,
      name: config.name,
      requested_url: sanitizeUrl(config.url),
      requested_url_sha256: sha256(sanitizeUrl(config.url)),
      authorization: {
        confirmed: true,
        confirmed_by: config.authorization.confirmed_by,
        confirmed_at: config.authorization.confirmed_at,
        scope_note: config.authorization.scope_note,
        allowed_navigation_origins: allowedNavigationOrigins(config),
      },
    },
    page: {
      final_url: sanitizeUrl(finalRawUrl),
      final_url_sha256: sha256(sanitizeUrl(finalRawUrl)),
      title: titleNode ? nodeText(titleNode).trim() : "",
      http_status: mainResponse.status,
      readiness: readinessEvidence(config, markerId ? "PRESENT" : "NOT_CONFIGURED"),
      rendered_dom_sha256: sha256(htmlBuffer),
      security_headers: selectSecurityHeaders(Object.fromEntries(mainResponse.headers.entries())),
    },
    scripts,
    network_origins: summarizeOrigins(networkOrigins, firstPartyOrigin),
    warnings,
    privacy: {
      response_bodies_stored: false,
      inline_script_content_stored: false,
      query_values_stored: false,
      cookies_stored: false,
      form_values_collected: false,
    },
  };
  snapshot.snapshot_sha256 = digestObject(snapshot);
  return snapshot;
}

export async function scanPage(config, options = {}) {
  return config.scan.mode === "browser"
    ? scanWithBrowser(config, options)
    : scanWithStaticFetch(config);
}

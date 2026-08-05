/* SecurityArts — client analytics (PostHog), inert by default.
   Loads only when the server reports a PostHog key (GET /api/auth/config → posthog).
   Exposes window.SAAnalytics.{capture, identify, reset}; calls made before PostHog
   finishes loading are queued and flushed. No key / static host → silent no-op. */
(function () {
  "use strict";
  var ready = false, queued = [];

  function run(fn) { if (ready && window.posthog) { try { fn(window.posthog); } catch (e) {} } else queued.push(fn); }

  window.SAAnalytics = {
    capture: function (event, props) { run(function (ph) { ph.capture(event, props || {}); }); },
    identify: function (id, props) { run(function (ph) { ph.identify(id, props || {}); }); },
    reset: function () { run(function (ph) { ph.reset(); }); },
  };

  function boot(key, host) {
    var s = document.createElement("script");
    s.async = true;
    s.src = host.replace(/\/+$/, "") + "/static/array.js";
    s.onload = function () {
      try {
        window.posthog.init(key, { api_host: host, person_profiles: "identified_only", capture_pageview: true });
        ready = true;
        queued.forEach(function (fn) { try { fn(window.posthog); } catch (e) {} });
        queued = [];
      } catch (e) {}
    };
    document.head.appendChild(s);
  }

  try {
    fetch("/api/auth/config", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) { var d = j && j.data; if (d && d.posthog) boot(d.posthog, d.posthogHost || "https://us.i.posthog.com"); })
      .catch(function () {});
  } catch (e) {}
})();

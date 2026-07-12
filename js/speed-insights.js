/* SecurityArts Speed Insights integration.
   Loads Vercel Speed Insights to track web vitals and performance metrics.
   Automatically initializes when this script is loaded. */
(function () {
  "use strict";

  // Import and inject Speed Insights
  // Since this is a vanilla JS environment, we'll use a dynamic import
  if (typeof window !== "undefined") {
    // Queue-based initialization (from the official docs)
    window.si = window.si || function () {
      (window.siq = window.siq || []).push(arguments);
    };

    // Load the Speed Insights script
    var script = document.createElement("script");
    script.src = "/_vercel/speed-insights/script.js";
    script.defer = true;
    script.dataset.sdkn = "@vercel/speed-insights";
    script.dataset.sdkv = "2.0.0";
    
    script.onerror = function () {
      console.log(
        "[Vercel Speed Insights] Failed to load script. Please check if any content blockers are enabled and try again."
      );
    };
    
    document.head.appendChild(script);
  }
})();

(function () {
  "use strict";

  var PIXEL_ID = "1444720010946620";

  function ensurePixel() {
    if (!PIXEL_ID) return false;
    if (!window.fbq) {
      !function(f,b,e,v,n,t,s){
        if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)
      }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", PIXEL_ID);
    }
    return true;
  }

  function serviceName() {
    var form = document.querySelector("[data-quote-flow-form]");
    if (form && form.dataset.service) return form.dataset.service;
    if (window.flowConfig && window.flowConfig.serviceLabel) return window.flowConfig.serviceLabel;
    return "";
  }

  function track() {
    if (!ensurePixel()) return;
    window.fbq("track", "PageView");

    if (document.querySelector("[data-quote-flow-form]")) {
      window.fbq("track", "ViewContent", {
        content_category: "Service Request",
        content_name: serviceName() || "Service Request"
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", track, { once: true });
  } else {
    track();
  }
})();
/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "2745aa30269916f81c2d97cb15b84d41"
  }, {
    "url": "pwa-512x512.png",
    "revision": "089a0c4fd71f49c38fc4a3381f34b1f4"
  }, {
    "url": "pwa-192x192.png",
    "revision": "443be52159f4b4689e113096698731aa"
  }, {
    "url": "index.html",
    "revision": "a0daaccf471c0c28d9a4f0f7bd0fe2c2"
  }, {
    "url": "icon.svg",
    "revision": "6c79af00ab6511ac5eb5c551cfc4d71b"
  }, {
    "url": "icon-maskable.svg",
    "revision": "f218df99fc60ee3f6ad1e0a0435426a8"
  }, {
    "url": "favicon.ico",
    "revision": "70278a9385beb3fdc7d06544d29d54f9"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "68fc0a6a7b0daa2b61e6c0a7089943ea"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/index-DtqZmCzD.css",
    "revision": null
  }, {
    "url": "assets/index-B8JlynZb.js",
    "revision": null
  }, {
    "url": "assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Typewriter-Regular-C0xS9mPB.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Size4-Regular-BF-4gkZK.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Size3-Regular-CTq5MqoE.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Size2-Regular-oD1tc_U0.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Size2-Regular-Dy4dx90m.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Size1-Regular-mCD8mA8B.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Size1-Regular-C195tn64.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Script-Regular-D5yQViql.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Script-Regular-D3wIWfF6.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_SansSerif-Regular-CS6fqUqJ.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_SansSerif-Italic-DN2j7dab.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_SansSerif-Bold-DbIhKOiC.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Math-Italic-t53AETM-.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Math-Italic-DA0__PXp.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Math-BoldItalic-iY-2wyZ7.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Main-Regular-Dr94JaBh.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Main-Regular-B22Nviop.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Main-Italic-NWA7e6Wa.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Main-Italic-BMLOBm91.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Main-BoldItalic-SpSLRI95.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Main-Bold-Jm3AIy58.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Main-Bold-Cx986IdX.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Fraktur-Regular-Dxdc4cR9.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Fraktur-Bold-BsDP51OF.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Caligraphic-Regular-CTRA-rTL.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2",
    "revision": null
  }, {
    "url": "assets/KaTeX_Caligraphic-Bold-BEiXGLvX.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_AMS-Regular-DMm9YOAa.woff",
    "revision": null
  }, {
    "url": "assets/KaTeX_AMS-Regular-BQhdFMY1.woff2",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "68fc0a6a7b0daa2b61e6c0a7089943ea"
  }, {
    "url": "favicon.ico",
    "revision": "70278a9385beb3fdc7d06544d29d54f9"
  }, {
    "url": "icon.svg",
    "revision": "6c79af00ab6511ac5eb5c551cfc4d71b"
  }, {
    "url": "pwa-192x192.png",
    "revision": "443be52159f4b4689e113096698731aa"
  }, {
    "url": "pwa-512x512.png",
    "revision": "089a0c4fd71f49c38fc4a3381f34b1f4"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "2745aa30269916f81c2d97cb15b84d41"
  }, {
    "url": "manifest.webmanifest",
    "revision": "3ba418b56f615f532d7ce3481e5817ec"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/auth\//, /^\/ws\//, /^\/\.well-known\//]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 12,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 16,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));

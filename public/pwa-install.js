/**
 * PWA Installation & Service Worker Setup
 * 
 * This script:
 * 1. Registers the service worker for offline support
 * 2. Detects if PWA install is available
 * 3. Provides install prompt functionality
 * 4. Handles service worker updates
 */

(function() {
  'use strict';

  // ================================================================
  // SERVICE WORKER REGISTRATION
  // ================================================================

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration);

          // Check for updates every 60 seconds
          setInterval(() => {
            registration.update();
          }, 60000);

          // Listen for new service worker ready
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[PWA] New Service Worker found');

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Service Worker update available');
                
                // Dispatch event so UI can show "update available" notification
                window.dispatchEvent(new CustomEvent('pwaUpdateAvailable', {
                  detail: { registration }
                }));
              }
            });
          });
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });
    });

    // Handle service worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] New Service Worker is now active');
    });
  } else {
    console.info('[PWA] Service Workers not supported');
  }

  // ================================================================
  // PWA INSTALL PROMPT HANDLING
  // ================================================================

  let deferredPrompt = null;
  const PWA_INSTALL_KEY = 'pwa-install-hidden';

  /**
   * Store the beforeinstallprompt event for later use
   */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');
    
    // Dispatch event so UI can show install button
    window.dispatchEvent(new CustomEvent('pwaInstallPromptReady'));
  });

  /**
   * Trigger PWA installation
   * Call this function from your UI when user clicks "Install" button
   */
  window.installPWA = async function() {
    if (!deferredPrompt) {
      console.warn('[PWA] Install prompt not available');
      return false;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log(`[PWA] User response to install prompt: ${outcome}`);
      
      deferredPrompt = null;
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('[PWA] Install failed:', error);
      return false;
    }
  };

  /**
   * Check if app is installed as PWA
   */
  window.isPWAInstalled = function() {
    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isFullScreen = window.navigator.standalone === true;
    
    return isStandalone || isFullScreen || (isIOS && window.navigator.standalone === true);
  };

  /**
   * Check if install prompt is available
   */
  window.isPWAInstallable = function() {
    return deferredPrompt !== null;
  };

  /**
   * Hide install prompt UI
   */
  window.hidePWAPrompt = function() {
    sessionStorage.setItem(PWA_INSTALL_KEY, 'true');
    window.dispatchEvent(new CustomEvent('pwaPromptHidden'));
  };

  /**
   * Check if install prompt was hidden by user
   */
  window.isPWAPromptHidden = function() {
    return sessionStorage.getItem(PWA_INSTALL_KEY) === 'true';
  };

  // ================================================================
  // APP INSTALLED EVENT
  // ================================================================

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App successfully installed');
    deferredPrompt = null;
    
    // Dispatch event for UI to handle
    window.dispatchEvent(new CustomEvent('pwaAppInstalled'));
  });

  // ================================================================
  // DISPLAY MODE DETECTION
  // ================================================================

  const displayModeQuery = window.matchMedia('(display-mode: standalone)');

  displayModeQuery.addEventListener('change', (e) => {
    if (e.matches) {
      console.log('[PWA] App is now running as standalone PWA');
    } else {
      console.log('[PWA] App is running in browser');
    }
  });

  // Check initial state
  if (displayModeQuery.matches) {
    console.log('[PWA] App running as PWA');
  }

  // ================================================================
  // EXPOSE API TO WINDOW
  // ================================================================

  window.PWA = {
    install: window.installPWA,
    isInstalled: window.isPWAInstalled,
    isInstallable: window.isPWAInstallable,
    hidePrompt: window.hidePWAPrompt,
    isPromptHidden: window.isPWAPromptHidden,
    getStatus: () => ({
      installed: window.isPWAInstalled(),
      installable: window.isPWAInstallable(),
      promptHidden: window.isPWAPromptHidden(),
      online: navigator.onLine,
      userAgent: navigator.userAgent
    })
  };

  console.log('[PWA] Initialized. Use window.PWA for control.');
})();

// ==============================================================================
// SREDA AI 2.0 — Entrance Splash Animation
// Exact Vector Choreography from Markus's Master Reference (7.0s normalized to 4.8s)
// ==============================================================================

(function () {
  'use strict';

  function initIntroSplash() {
    const overlay = document.getElementById('intro-splash-overlay');
    if (!overlay) return;

    const canvas = document.getElementById('splashCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const textWhite = document.getElementById('textWhite');
    const textRed = document.getElementById('textRed');
    const textCursor = document.getElementById('textCursor');
    const laserBar = document.getElementById('laserBar');
    const telemetryText = document.getElementById('telemetryText');
    const skipBtn = document.getElementById('btn-skip-splash');

    const baseSize = 360;
    const TOTAL_DURATION = 5000; // ms
    const speed = 1.0;
    let startTime = null;
    let isFinished = false;

    function getTelemetry(progress) {
      if (progress < 0.22) return '[INITIALIZING BOOT SUBSYSTEMS...]';
      if (progress < 0.48) return '[INFERENCE CORE: VULKAN & ZEN4 LOADED]';
      if (progress < 0.72) return '[RAG CONTEXT ENGINE: READY]';
      if (progress < 0.92) return '[MODEL: BONSAI 2 (27B) PTQ1.0 • 5.95 GB]';
      return '[SYSTEM ONLINE • SREDA AI READY]';
    }

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    }

    function drawLogo(t) {
      ctx.clearRect(0, 0, baseSize, baseSize);

      const cx = baseSize / 2;
      const cy = baseSize / 2;
      const R = (baseSize / 2) * 0.88;

      // A. Genesis Flash (0.0s -> 1.4s)
      let genesisFlash = 0;
      let genesisColorMix = 0;
      if (t < 1400) {
        if (t < 300) {
          const p = t / 300;
          genesisFlash = Math.sin((p * Math.PI) / 2);
          genesisColorMix = 0;
        } else {
          const decay = (t - 300) / 1100;
          genesisFlash = Math.pow(1 - decay, 1.6);
          genesisColorMix = clamp(decay * 1.3, 0, 1);
        }
      }

      // B. Star Silhouette Manifestation
      const starEntranceProg = clamp((t - 120) / 900, 0, 1);
      const starOpacity = easeInOutCubic(starEntranceProg);

      // C. Deep Ambient Red Aura
      const auraProg = clamp((t - 450) / 3000, 0, 1);
      const redAura = Math.sin(auraProg * Math.PI);

      // D. Stars Counter-Rotation (0.8s -> 2.4s)
      const rotProg = clamp((t - 800) / 1600, 0, 1);
      const easedRot = easeInOutCubic(rotProg);
      const whiteRotation = (1 - easedRot) * (Math.PI / 4);
      const redRotation = -(1 - easedRot) * (Math.PI / 4);

      // E. Radar HUD drift
      const hudRotation = -0.15 + (t / TOTAL_DURATION) * 0.6;
      const hudOpacity = clamp(starOpacity * (t < 2400 ? 0.35 + (t / 2400) * 0.45 : 1.0), 0, 1);

      // F. Central Red Dot Breathing Pulse (at lock-in t >= 2400ms)
      let corePulseScale = 1.0;
      if (t >= 2400) {
        const cycleDuration = 900;
        const cycleProgress = ((t - 2400) % cycleDuration) / cycleDuration;
        corePulseScale = 1.0 + 0.32 * Math.sin(cycleProgress * Math.PI);
      }

      // --- RENDER PASSES ---
      // 0. Ambient Red Glow Aura
      if (redAura > 0.01) {
        ctx.save();
        const grad = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 0.9);
        grad.addColorStop(0, `rgba(239, 68, 68, ${0.36 * redAura})`);
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 1. Background Radar HUD
      if (hudOpacity > 0.01) {
        drawRadarHud(ctx, cx, cy, R, hudOpacity, hudRotation);
      }

      // 2. Stars rendering
      if (starOpacity > 0.01) {
        ctx.save();
        ctx.globalAlpha = starOpacity;

        // Red Diagonal Star
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(redRotation + Math.PI / 4);
        drawContinuousFacetedStar(ctx, {
          tipRadius: R * 1.02,
          innerRadius: R * 0.18,
          litColor: '#ef4444',
          shadowColor: '#991b1b',
          seamColor: '#0a0a0a',
          outlineColor: '#0a0a0a'
        });
        ctx.restore();

        // White Cardinal Star
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(whiteRotation);
        drawContinuousFacetedStar(ctx, {
          tipRadius: R * 1.0,
          innerRadius: R * 0.21,
          litColor: '#ffffff',
          shadowColor: '#d5d8de',
          seamColor: '#0a0a0a',
          outlineColor: '#0a0a0a'
        });
        ctx.restore();

        // Central Hub
        drawCenterHub(ctx, cx, cy, R, corePulseScale);
        ctx.restore();
      }

      // 3. Genesis Opening Flash
      if (genesisFlash > 0.01) {
        ctx.save();
        const flashRadius = R * (0.65 + genesisFlash * 0.45);
        const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, flashRadius);

        const rVal = Math.round(255 - genesisColorMix * 16);
        const gVal = Math.round(255 - genesisColorMix * 187);
        const bVal = Math.round(255 - genesisColorMix * 187);

        flashGrad.addColorStop(0, `rgba(${rVal}, ${gVal}, ${bVal}, ${genesisFlash * 0.95})`);
        flashGrad.addColorStop(0.35, `rgba(${rVal}, ${gVal}, ${bVal}, ${genesisFlash * 0.65})`);
        flashGrad.addColorStop(0.7, `rgba(239, 68, 68, ${genesisFlash * 0.35})`);
        flashGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, flashRadius, 0, Math.PI * 2);
        ctx.fill();

        if (t < 350) {
          const coreSpark = Math.sin((t / 350) * Math.PI);
          ctx.fillStyle = `rgba(255, 255, 255, ${coreSpark})`;
          ctx.beginPath();
          ctx.arc(cx, cy, R * 0.12 * coreSpark, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    function drawContinuousFacetedStar(ctx, cfg) {
      const { tipRadius, innerRadius, litColor, shadowColor, seamColor, outlineColor } = cfg;

      const tips = [
        { x: 0, y: -tipRadius },
        { x: tipRadius, y: 0 },
        { x: 0, y: tipRadius },
        { x: -tipRadius, y: 0 }
      ];

      const diag = 0.70710678118;
      const valleys = [
        { x: innerRadius * diag, y: -innerRadius * diag },
        { x: innerRadius * diag, y: innerRadius * diag },
        { x: -innerRadius * diag, y: innerRadius * diag },
        { x: -innerRadius * diag, y: -innerRadius * diag }
      ];

      const facetIndices = [
        [3, 0],
        [0, 1],
        [1, 2],
        [2, 3]
      ];

      ctx.lineWidth = 1.3;
      ctx.lineJoin = 'round';

      for (let i = 0; i < 4; i++) {
        const vLeft = valleys[facetIndices[i][0]];
        const vRight = valleys[facetIndices[i][1]];
        const tip = tips[i];

        // Lit facet
        ctx.fillStyle = litColor;
        ctx.strokeStyle = seamColor;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(vLeft.x, vLeft.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Shadow facet
        ctx.fillStyle = shadowColor;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tip.x, tip.y);
        ctx.lineTo(vRight.x, vRight.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Central spine seam
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
      }

      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tips[0].x, tips[0].y);
      ctx.lineTo(valleys[0].x, valleys[0].y);
      ctx.lineTo(tips[1].x, tips[1].y);
      ctx.lineTo(valleys[1].x, valleys[1].y);
      ctx.lineTo(tips[2].x, tips[2].y);
      ctx.lineTo(valleys[2].x, valleys[2].y);
      ctx.lineTo(tips[3].x, tips[3].y);
      ctx.lineTo(valleys[3].x, valleys[3].y);
      ctx.closePath();
      ctx.stroke();
    }

    function drawRadarHud(ctx, cx, cy, R, opacity, rot) {
      const rOuter = R * 0.88;
      const rMid = R * 0.74;
      const rInner = R * 0.58;

      ctx.save();
      ctx.strokeStyle = `rgba(74, 78, 87, ${0.75 * opacity})`;
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(220, 38, 38, ${0.85 * opacity})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, rMid, rot - Math.PI / 3, rot + Math.PI / 6);
      ctx.stroke();

      ctx.strokeStyle = `rgba(74, 78, 87, ${0.75 * opacity})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx, cy, rMid, rot + (2 * Math.PI) / 3, rot + Math.PI);
      ctx.stroke();

      const tickCount = 28;
      ctx.strokeStyle = `rgba(74, 78, 87, ${0.8 * opacity})`;
      ctx.lineWidth = 1.0;
      for (let i = 0; i < tickCount; i++) {
        const a = (i * (2 * Math.PI)) / tickCount + rot;
        const mod = Math.abs(a % (Math.PI / 2));
        if (mod < 0.15 || Math.PI / 2 - mod < 0.15) continue;

        const p1x = cx + Math.cos(a) * (rOuter - 4);
        const p1y = cy + Math.sin(a) * (rOuter - 4);
        const p2x = cx + Math.cos(a) * (rOuter + 3);
        const p2y = cy + Math.sin(a) * (rOuter + 3);

        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
      }

      const nodeAngles = [rot + 0.35, rot + 1.25, rot + 2.45, rot + 3.8, rot + 4.95, rot + 5.75];
      for (let i = 0; i < nodeAngles.length; i++) {
        const a = nodeAngles[i];
        const targetR = i % 2 === 0 ? rOuter : rMid;
        const nx = cx + Math.cos(a) * targetR;
        const ny = cy + Math.sin(a) * targetR;

        ctx.beginPath();
        if (i === 2) {
          ctx.fillStyle = `rgba(239, 68, 68, ${0.9 * opacity})`;
          ctx.arc(nx, ny, 2.6, 0, Math.PI * 2);
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * opacity})`;
          ctx.arc(nx, ny, 2.0, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.restore();
    }

    function drawCenterHub(ctx, cx, cy, R, corePulseScale) {
      const hubRadius = R * 0.11;
      const baseCoreRadius = R * 0.042;
      const currentCoreRadius = baseCoreRadius * corePulseScale;

      // 1. Black disc hub
      ctx.fillStyle = '#080808';
      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 2. Pure smooth red glow
      const glow = ctx.createRadialGradient(cx, cy, currentCoreRadius * 0.5, cx, cy, currentCoreRadius * 2.4);
      glow.addColorStop(0, `rgba(239, 68, 68, ${0.85 * (corePulseScale > 1.1 ? 1.0 : 0.65)})`);
      glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, currentCoreRadius * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // 3. Solid uniform red core dot
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, currentCoreRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    function updateDOM(t) {
      // Typewriter (2.6s -> 4.0s)
      const fullText = 'SREDA AI';
      let charsCount = 0;
      if (t >= 2600) {
        const typeProg = clamp((t - 2600) / 1300, 0, 1);
        charsCount = Math.floor(typeProg * fullText.length);
      }

      const typedStr = fullText.substring(0, charsCount);
      if (textWhite && textRed) {
        if (typedStr.length <= 5) {
          textWhite.textContent = typedStr;
          textRed.textContent = '';
        } else if (typedStr.length === 6) {
          textWhite.textContent = 'SREDA ';
          textRed.textContent = '';
        } else {
          textWhite.textContent = 'SREDA ';
          textRed.textContent = typedStr.substring(6);
        }
      }

      if (textCursor) {
        textCursor.style.visibility = charsCount > 0 && charsCount < fullText.length ? 'visible' : 'hidden';
      }

      // Laser Bar (3.0s -> 4.8s)
      let loaderVal = 0;
      if (t >= 3000) {
        const loadProg = clamp((t - 3000) / 1800, 0, 1);
        loaderVal = easeInOutCubic(loadProg);
      }
      if (laserBar) laserBar.style.width = loaderVal * 100 + '%';
      if (telemetryText) telemetryText.textContent = getTelemetry(loaderVal);
    }

    function finishSplash() {
      if (isFinished) return;
      isFinished = true;
      overlay.style.pointerEvents = 'none';
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.style.display = 'none';
        const inp = document.getElementById('chat-input');
        if (inp) inp.focus();
      }, 600);
    }

    function loop(now) {
      if (isFinished) return;
      if (!startTime) startTime = now;
      const elapsed = (now - startTime) * speed;

      drawLogo(elapsed);
      updateDOM(elapsed);

      if (elapsed >= TOTAL_DURATION) {
        finishSplash();
      } else {
        requestAnimationFrame(loop);
      }
    }

    if (skipBtn) {
      skipBtn.onclick = finishSplash;
    }
    overlay.onclick = (e) => {
      // Click anywhere after 1 second skips
      if (startTime && (performance.now() - startTime) > 1000) {
        finishSplash();
      }
    };

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIntroSplash);
  } else {
    initIntroSplash();
  }
})();

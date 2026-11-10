// SREDA AI - Canvas Star Animation
function initStarAnimation(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let angle = 0;
  let pulse = 0;

  function render() {
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) * 0.42;

    ctx.clearRect(0, 0, width, height);

    // 1. Orbital Outer Rings
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 0.95, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(239, 68, 68, 0.18)";
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 0.8, 0, Math.PI * 2);
    ctx.stroke();

    // Orbital satellites
    const sat1X = Math.cos(angle * 0.5) * (baseRadius * 0.95);
    const sat1Y = Math.sin(angle * 0.5) * (baseRadius * 0.95);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(sat1X, sat1Y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    const sat2X = Math.cos(-angle * 0.8) * (baseRadius * 0.8);
    const sat2Y = Math.sin(-angle * 0.8) * (baseRadius * 0.8);
    ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
    ctx.beginPath();
    ctx.arc(sat2X, sat2Y, 2.0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 8 Rays Star (4 Cardinal White/Silver, 4 Diagonal Red)
    const cardinalLen = baseRadius * 0.9;
    const diagonalLen = baseRadius * 0.72;
    const innerRadius = baseRadius * 0.18;

    for (let i = 0; i < 8; i++) {
      const rayAngle = (i * Math.PI) / 4;
      const isCardinal = i % 2 === 0;
      const rayLen = isCardinal ? cardinalLen : diagonalLen;

      const tipX = Math.cos(rayAngle) * rayLen;
      const tipY = Math.sin(rayAngle) * rayLen;

      const leftAngle = rayAngle - Math.PI / 8;
      const rightAngle = rayAngle + Math.PI / 8;

      const leftX = Math.cos(leftAngle) * innerRadius;
      const leftY = Math.sin(leftAngle) * innerRadius;

      const rightX = Math.cos(rightAngle) * innerRadius;
      const rightY = Math.sin(rightAngle) * innerRadius;

      // Left facet
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(tipX, tipY);
      ctx.closePath();
      ctx.fillStyle = isCardinal ? "#F3F4F6" : "#EF4444";
      ctx.fill();

      // Right facet
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
      ctx.fillStyle = isCardinal ? "#9CA3AF" : "#991B1B";
      ctx.fill();
    }

    // 3. Central Disc
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = "#0B0C0E";
    ctx.fill();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4. Pulsing Red Center Core
    const pulseFactor = 1 + Math.sin(pulse) * 0.25;
    const coreGlow = ctx.createRadialGradient(0, 0, 1, 0, 0, innerRadius * 0.7 * pulseFactor);
    coreGlow.addColorStop(0, "rgba(239, 68, 68, 0.95)");
    coreGlow.addColorStop(0.5, "rgba(239, 68, 68, 0.4)");
    coreGlow.addColorStop(1, "rgba(239, 68, 68, 0)");

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.7 * pulseFactor, 0, Math.PI * 2);
    ctx.fillStyle = coreGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "#EF4444";
    ctx.fill();

    ctx.restore();

    angle += 0.015;
    pulse += 0.04;
    requestAnimationFrame(render);
  }

  render();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initStarAnimation('star-canvas'));
  } else {
    initStarAnimation('star-canvas');
  }
}


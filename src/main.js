// ── Intersection Observer for reveal animations ──
const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
}, observerOptions);
document.querySelectorAll('.reveal, .word-reveal').forEach(el => observer.observe(el));


// ── Sticky project card scale effect ──
window.addEventListener('scroll', () => {
    const cards = document.querySelectorAll('.project-card');
    cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        if(rect.top < viewportHeight && rect.bottom > 0) {
            const progress = Math.min(Math.max((viewportHeight - rect.top) / viewportHeight, 0), 1);
            const scale = 1 - ((cards.length - 1 - index) * 0.02) - (progress * 0.03);
            card.style.transform = `scale(${scale})`;
        }
    });
});

// ── Chroma Key: remove green screen from avatar (fixed shoulder crop) ──
(function() {
    const canvas = document.getElementById('avatar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'avatar-green.png';

    img.onload = function() {
        const fullW = img.naturalWidth;
        const fullH = img.naturalHeight;

        // Use the full width of the image so the shoulder doesn't get clipped
        canvas.width  = fullW;
        canvas.height = fullH;

        ctx.drawImage(img, 0, 0);

        // Erase Gemini star: it sits strictly in bottom-right corner of image (~90-100% x, ~85-100% y)
        // Clearing from 90% of width and 85% of height preserves the avatar shoulder completely
        ctx.clearRect(Math.floor(fullW * 0.90), Math.floor(fullH * 0.85), fullW, fullH);

        const imageData = ctx.getImageData(0, 0, fullW, fullH);
        const d = imageData.data;

        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i+1], b = d[i+2];
            if (g > 90 && g > r * 1.35 && g > b * 1.35) {
                const greenness = Math.min(1, (g - Math.max(r, b)) / 80);
                d[i+3] = Math.round(d[i+3] * (1 - greenness));
            }
        }
        ctx.putImageData(imageData, 0, 0);
    };

    img.onerror = function() {
        console.warn('Avatar image failed to load.');
    };
})();

// ── Theme Settings Drawer Logic ──
const settingsBtn = document.getElementById('settings-btn');
const settingsDrawer = document.getElementById('settings-drawer');
const closeSettingsBtn = document.getElementById('close-settings-btn');

if(settingsBtn && settingsDrawer && closeSettingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDrawer.classList.toggle('translate-x-full');
    });
    closeSettingsBtn.addEventListener('click', () => {
        settingsDrawer.classList.add('translate-x-full');
    });
    // Close on click outside
    document.addEventListener('click', (e) => {
        if(!settingsDrawer.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsDrawer.classList.add('translate-x-full');
        }
    });
}

// ── Theme Management ──
function setAccentTheme(themeName) {
    const themes = {
        purple: {
            a1: '#7c3aed',
            a2: '#a855f7',
            a3: '#c084fc',
            glow: 'rgba(168, 85, 247, 0.4)'
        },
        emerald: {
            a1: '#059669',
            a2: '#10b981',
            a3: '#34d399',
            glow: 'rgba(16, 185, 129, 0.4)'
        },
        blue: {
            a1: '#2563eb',
            a2: '#3b82f6',
            a3: '#60a5fa',
            glow: 'rgba(59, 130, 246, 0.4)'
        },
        orange: {
            a1: '#ea580c',
            a2: '#f97316',
            a3: '#fb923c',
            glow: 'rgba(249, 115, 22, 0.4)'
        }
    };
    const theme = themes[themeName] || themes.purple;
    document.documentElement.style.setProperty('--accent-1', theme.a1);
    document.documentElement.style.setProperty('--accent-2', theme.a2);
    document.documentElement.style.setProperty('--accent-3', theme.a3);
    document.documentElement.style.setProperty('--accent-glow', theme.glow);
    localStorage.setItem('selected-theme', themeName);

    // Update UI buttons indicators
    document.querySelectorAll('.theme-option-btn').forEach(btn => {
        const indicator = btn.querySelector('.theme-status');
        const isCurrent = btn.getAttribute('data-theme') === themeName;
        if (indicator) {
            indicator.textContent = isCurrent ? 'Active' : 'Select';
            if (isCurrent) {
                indicator.classList.remove('opacity-0');
            } else {
                indicator.classList.add('opacity-0');
            }
        }
        if (isCurrent) {
            btn.classList.add('border-white/20', 'bg-white/[0.08]');
        } else {
            btn.classList.remove('border-white/20', 'bg-white/[0.08]');
        }
    });
}

// Initialize theme from storage
const savedTheme = localStorage.getItem('selected-theme') || 'purple';
setAccentTheme(savedTheme);

// ── Spotlight Reveal Logic (Geology reveal overlay + Soft ambient glow) ──
(function() {
    const revealLayer = document.getElementById('hero-reveal-layer');
    const cursorGlow = document.getElementById('hero-cursor-glow');
    if (!revealLayer) return;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.style.display = 'none';
    document.body.appendChild(maskCanvas);
    const maskCtx = maskCanvas.getContext('2d');

    const cachedRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    function resizeMaskCanvas() {
        cachedRect.width = window.innerWidth;
        cachedRect.height = window.innerHeight;
        cachedRect.left = 0;
        cachedRect.top = 0;
        maskCanvas.width = Math.floor(window.innerWidth / 2);
        maskCanvas.height = Math.floor(window.innerHeight / 2);
    }
    window.addEventListener('resize', resizeMaskCanvas);
    resizeMaskCanvas();

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const smooth = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const SPOTLIGHT_R = 360; // Soft wide radius

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX - cachedRect.left;
        mouse.y = e.clientY - cachedRect.top;
    });

    function updateSpotlight() {
        // Lerp mouse coordinates
        smooth.x += (mouse.x - smooth.x) * 0.1;
        smooth.y += (mouse.y - smooth.y) * 0.1;

        const cw = maskCanvas.width;
        const ch = maskCanvas.height;

        if (cw > 0 && ch > 0) {
            maskCtx.clearRect(0, 0, cw, ch);

            // Scale coordinates for the half-res canvas
            const scaleX = cw / cachedRect.width;
            const scaleY = ch / cachedRect.height;
            const cx = smooth.x * scaleX;
            const cy = smooth.y * scaleY;
            const r = SPOTLIGHT_R * scaleX;

            // Stretch context to create a horizontal ellipse shape (not round)
            maskCtx.save();
            maskCtx.translate(cx, cy);
            maskCtx.scale(1.5, 0.85); // Stretches width by 1.5x, squashes height by 0.85x

            const grad = maskCtx.createRadialGradient(0, 0, 0, 0, 0, r);
            // Extremely diffuse stops to form a soft ambient glow, removing hard round borders
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.2, 'rgba(255,255,255,0.85)');
            grad.addColorStop(0.6, 'rgba(255,255,255,0.3)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');

            maskCtx.fillStyle = grad;
            maskCtx.beginPath();
            maskCtx.arc(0, 0, r, 0, Math.PI * 2);
            maskCtx.fill();
            maskCtx.restore();

            // Apply bottom fade mask directly to the spotlight reveal canvas to blend seamlessly
            maskCtx.globalCompositeOperation = 'destination-in';
            const bottomFade = maskCtx.createLinearGradient(0, 0, 0, ch);
            bottomFade.addColorStop(0, 'rgba(255,255,255,1)');
            bottomFade.addColorStop(0.6, 'rgba(255,255,255,1)');
            bottomFade.addColorStop(0.95, 'rgba(255,255,255,0)');
            maskCtx.fillStyle = bottomFade;
            maskCtx.fillRect(0, 0, cw, ch);
            maskCtx.globalCompositeOperation = 'source-over';

            const maskDataUrl = maskCanvas.toDataURL('image/png');
            revealLayer.style.maskImage = `url(${maskDataUrl})`;
            revealLayer.style.webkitMaskImage = `url(${maskDataUrl})`;
        }

        if (cursorGlow) {
            cursorGlow.style.left = `${smooth.x}px`;
            cursorGlow.style.top = `${smooth.y}px`;
        }

        requestAnimationFrame(updateSpotlight);
    }
    requestAnimationFrame(updateSpotlight);
})();

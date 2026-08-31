// ═════════════════════════════════════════════════════════════════
// PARAS LASHKARI PORTFOLIO — CORE SCRIPT & INTERACTIVE ENGINE
// ═════════════════════════════════════════════════════════════════

// ── 1. Intersection Observer for Reveal Animations ──
const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -40px 0px" };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, observerOptions);
document.querySelectorAll('.reveal, .word-reveal').forEach(el => observer.observe(el));


// ── 2. Sticky Project Card Scale Effect & 3D Tilt ──
window.addEventListener('scroll', () => {
    const cards = document.querySelectorAll('.project-card');
    const viewportHeight = window.innerHeight;
    cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.bottom > 0) {
            const progress = Math.min(Math.max((viewportHeight - rect.top) / viewportHeight, 0), 1);
            const scale = 1 - ((cards.length - 1 - index) * 0.015) - (progress * 0.02);
            card.style.transform = `scale(${scale})`;
        }
    });
});

// Interactive 3D Card Hover Tilt
document.querySelectorAll('.project-card').forEach(card => {
    const inner = card.querySelector('.w-full');
    if (!inner) return;

    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const rotX = -(y / (rect.height / 2)) * 5;
        const rotY = (x / (rect.width / 2)) * 5;
        inner.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
        inner.style.transition = 'transform 0.1s ease-out';
    });

    card.addEventListener('mouseleave', () => {
        inner.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        inner.style.transition = 'transform 0.5s ease-out';
    });
});


// ── 3. Chroma Key Avatar (Green Screen Remover + Shoulder Fix) ──
(function initAvatar() {
    const canvas = document.getElementById('avatar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'avatar-green.png';

    img.onload = function() {
        const fullW = img.naturalWidth;
        const fullH = img.naturalHeight;

        canvas.width  = fullW;
        canvas.height = fullH;

        ctx.drawImage(img, 0, 0);

        // Erase watermark in bottom-right corner (~90-100% x, ~85-100% y)
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

// ── 3D Canvas Chroma Keyer (Removes ALL black frame pixels on the fly with geometric masking) ──
(function init3DCanvases() {
    const canvases = document.querySelectorAll('.chroma-3d-canvas');
    canvases.forEach(canvas => {
        const src = canvas.getAttribute('data-src');
        const isCircle = canvas.getAttribute('data-mask') === 'circle';
        if (!src) return;

        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;

        img.onload = function() {
            const w = img.naturalWidth || 512;
            const h = img.naturalHeight || 512;
            canvas.width = w;
            canvas.height = h;

            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, w, h);
            const d = imgData.data;

            const cx = w / 2;
            const cy = h / 2;
            const radius = Math.min(w, h) * 0.48;

            for (let i = 0; i < d.length; i += 4) {
                const px = (i / 4) % w;
                const py = Math.floor((i / 4) / w);
                
                // If circle mask requested (Sphere), remove everything outside the circle
                if (isCircle) {
                    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
                    if (dist > radius) {
                        d[i + 3] = 0;
                        continue;
                    } else if (dist > radius - 3) {
                        const edgeAlpha = Math.max(0, (radius - dist) / 3);
                        d[i + 3] = Math.round(d[i + 3] * edgeAlpha);
                    }
                }

                // Black chroma-key removal
                const r = d[i], g = d[i+1], b = d[i+2];
                const maxVal = Math.max(r, g, b);
                if (maxVal <= 8) {
                    d[i + 3] = 0;
                } else if (maxVal < 32) {
                    const alphaRatio = (maxVal - 8) / (32 - 8);
                    d[i + 3] = Math.round(d[i + 3] * alphaRatio);
                }
            }
            ctx.putImageData(imgData, 0, 0);
        };
    });
})();


// ── 4. Web Audio API Ambient Generative Soundscape & UI Audio Synth ──
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.nodes = [];
        this.masterGain = null;
        this.isMuted = true;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
    }

    toggleAmbient() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (this.isPlaying) {
            this.stopAmbient();
        } else {
            this.startAmbient();
        }
        return this.isPlaying;
    }

    startAmbient() {
        if (!this.ctx) this.init();
        if (this.isPlaying) return;

        // Generative soothing harmonic pad (C-Major-9 chord: C3, G3, B3, D4, E4)
        const freqs = [130.81, 196.00, 246.94, 293.66, 329.63];
        this.nodes = [];

        const padFilter = this.ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.setValueAtTime(420, this.ctx.currentTime);
        padFilter.Q.setValueAtTime(2, this.ctx.currentTime);
        padFilter.connect(this.masterGain);

        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            // Subtle gentle detune chorus
            osc.detune.setValueAtTime((idx - 2) * 4, this.ctx.currentTime);

            gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.04 / freqs.length, this.ctx.currentTime + 3);

            osc.connect(gain);
            gain.connect(padFilter);
            osc.start();

            this.nodes.push(osc);
            this.nodes.push(gain);
        });

        // Gentle subtle LFO for organic breathing filter cutoff
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime);
        lfoGain.gain.setValueAtTime(120, this.ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(padFilter.frequency);
        lfo.start();

        this.nodes.push(lfo);
        this.nodes.push(lfoGain);

        this.isPlaying = true;
        this.updateUI();
    }

    stopAmbient() {
        if (!this.isPlaying) return;
        this.nodes.forEach(node => {
            try {
                if (node.stop) node.stop();
                if (node.disconnect) node.disconnect();
            } catch(e) {}
        });
        this.nodes = [];
        this.isPlaying = false;
        this.updateUI();
    }

    playChirp(type = 'hover') {
        if (!this.ctx) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            if (type === 'hover') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1400, now);
                osc.frequency.exponentialRampToValueAtTime(1800, now + 0.04);
                gain.gain.setValueAtTime(0.015, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
                osc.start(now);
                osc.stop(now + 0.045);
            } else if (type === 'click') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(900, now);
                osc.frequency.exponentialRampToValueAtTime(1300, now + 0.08);
                gain.gain.setValueAtTime(0.03, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.085);
            } else if (type === 'success') {
                // Happy major triad chime
                [523.25, 659.25, 783.99].forEach((f, i) => {
                    const o = this.ctx.createOscillator();
                    const g = this.ctx.createGain();
                    o.type = 'sine';
                    o.frequency.setValueAtTime(f, now + i * 0.06);
                    g.gain.setValueAtTime(0.03, now + i * 0.06);
                    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.25);
                    o.connect(g);
                    g.connect(this.masterGain);
                    o.start(now + i * 0.06);
                    o.stop(now + i * 0.06 + 0.25);
                });
                return;
            }

            osc.connect(gain);
            gain.connect(this.masterGain);
        } catch(e) {}
    }

    updateUI() {
        const toggleBtn = document.getElementById('sound-toggle-btn');
        const soundLabel = document.getElementById('sound-label');
        if (!toggleBtn) return;

        if (this.isPlaying) {
            toggleBtn.classList.add('sound-playing', 'border-purple-400/50', 'bg-purple-500/10');
            if (soundLabel) soundLabel.textContent = 'Sound: ON';
        } else {
            toggleBtn.classList.remove('sound-playing', 'border-purple-400/50', 'bg-purple-500/10');
            if (soundLabel) soundLabel.textContent = 'Sound';
        }
    }
}

const audio = new AudioEngine();

const soundToggleBtn = document.getElementById('sound-toggle-btn');
if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
        audio.toggleAmbient();
    });
}

// Auto unlock audio context on first user click/interaction
window.addEventListener('click', () => {
    if (!audio.ctx) audio.init();
}, { once: true });


// ── 5. Custom Magnetic Cursor & Hover Snapping ──
(function initMagneticCursor() {
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;

    // Check for fine pointer (desktop mouse)
    if (window.matchMedia('(pointer: fine)').matches) {
        document.body.classList.add('has-custom-cursor');
    } else {
        dot.style.display = 'none';
        ring.style.display = 'none';
        return;
    }

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let isHoveringMagnetic = false;
    let targetEl = null;

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    });

    // Smooth lerp loop for the outer ring
    function renderCursor() {
        const lerpFactor = isHoveringMagnetic ? 0.25 : 0.15;
        ringX += (mouseX - ringX) * lerpFactor;
        ringY += (mouseY - ringY) * lerpFactor;

        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
        requestAnimationFrame(renderCursor);
    }
    requestAnimationFrame(renderCursor);

    // Magnetic attachment logic
    document.querySelectorAll('.magnetic-item, button, a, .tech-tag').forEach(el => {
        el.addEventListener('mouseenter', () => {
            ring.classList.add('active-hover');
            isHoveringMagnetic = true;
            targetEl = el;

            const soundType = el.getAttribute('data-sound');
            if (soundType === 'hover') audio.playChirp('hover');
        });

        el.addEventListener('mousemove', (e) => {
            if (!targetEl) return;
            const rect = targetEl.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const pullX = (e.clientX - cx) * 0.22;
            const pullY = (e.clientY - cy) * 0.22;

            targetEl.style.transform = `translate3d(${pullX}px, ${pullY}px, 0)`;
        });

        el.addEventListener('mouseleave', () => {
            ring.classList.remove('active-hover');
            isHoveringMagnetic = false;
            if (targetEl) {
                targetEl.style.transform = '';
                targetEl = null;
            }
        });

        el.addEventListener('mousedown', () => {
            ring.classList.add('active-drag');
            const soundType = el.getAttribute('data-sound');
            if (soundType === 'click' || !soundType) audio.playChirp('click');
        });

        el.addEventListener('mouseup', () => {
            ring.classList.remove('active-drag');
        });
    });
})();


// ── 6. 3D Mouse Parallax on Floating Objects ──
(function init3DParallax() {
    const parallaxItems = document.querySelectorAll('.parallax-item');
    if (!parallaxItems.length) return;

    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;

    window.addEventListener('mousemove', (e) => {
        targetX = (e.clientX - window.innerWidth / 2);
        targetY = (e.clientY - window.innerHeight / 2);
    });

    function updateParallax() {
        currentX += (targetX - currentX) * 0.06;
        currentY += (targetY - currentY) * 0.06;

        parallaxItems.forEach(item => {
            const speed = parseFloat(item.getAttribute('data-parallax-speed') || 0.03);
            const moveX = currentX * speed;
            const moveY = currentY * speed;
            item.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
        });

        requestAnimationFrame(updateParallax);
    }
    requestAnimationFrame(updateParallax);
})();


// ── 7. 1-Click Email Copy & Direct Mail / Gmail Launch ──
window.copyEmailToClipboard = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const email = 'paras.l.d.2006@gmail.com';

    // 1. Copy to clipboard
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email);
    } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = email;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
    }

    // 2. Play feedback chime
    audio.playChirp('success');

    // 3. Show Toast notification
    const toast = document.getElementById('toast-container');
    const toastTitle = document.getElementById('toast-title');
    if (toastTitle) toastTitle.textContent = 'Copied & Opening Gmail...';
    
    if (toast) {
        toast.classList.remove('translate-y-12', 'opacity-0', 'pointer-events-none');
        toast.classList.add('translate-y-0', 'opacity-100');

        clearTimeout(window.toastTimer);
        window.toastTimer = setTimeout(() => {
            toast.classList.add('translate-y-12', 'opacity-0', 'pointer-events-none');
            toast.classList.remove('translate-y-0', 'opacity-100');
        }, 4000);
    }

    // 4. Simultaneously open Gmail compose in new tab, with mailto fallback
    setTimeout(() => {
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent('Project Inquiry — Web & 3D Experience')}`;
        const newTab = window.open(gmailUrl, '_blank');
        if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
            // If popup blocked or on mobile, fallback to standard mailto
            window.location.href = `mailto:${email}?subject=${encodeURIComponent('Project Inquiry — Web & 3D Experience')}`;
        }
    }, 250);
};


// ── 8. Interactive Device Frame Live Project Preview Modal ──
window.openDevicePreview = function(url, title) {
    const modal = document.getElementById('device-modal');
    const iframe = document.getElementById('preview-iframe');
    const loader = document.getElementById('iframe-loader');
    const titleEl = document.getElementById('preview-modal-title');
    const directLink = document.getElementById('preview-modal-direct-link');

    if (!modal || !iframe) return;

    if (loader) loader.style.opacity = '1';
    if (titleEl) titleEl.textContent = `${title} • Live Preview`;
    if (directLink) directLink.href = url;

    iframe.src = url;

    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100');
    document.body.style.overflow = 'hidden';

    audio.playChirp('click');
};

window.closeDevicePreview = function() {
    const modal = document.getElementById('device-modal');
    const iframe = document.getElementById('preview-iframe');

    if (!modal) return;
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.classList.remove('opacity-100');
    document.body.style.overflow = '';

    if (iframe) {
        setTimeout(() => { iframe.src = ''; }, 300);
    }
    audio.playChirp('click');
};

window.hideIframeLoader = function() {
    const loader = document.getElementById('iframe-loader');
    if (loader) loader.style.opacity = '0';
};

window.setDeviceViewport = function(type) {
    const wrapper = document.getElementById('device-frame-wrapper');
    const btnDesktop = document.getElementById('preview-btn-desktop');
    const btnMobile = document.getElementById('preview-btn-mobile');

    if (!wrapper) return;

    if (type === 'mobile') {
        wrapper.style.maxWidth = '390px';
        wrapper.style.borderRadius = '45px';
        wrapper.style.borderWidth = '8px';
        wrapper.style.borderColor = '#262626';
        if (btnDesktop) {
            btnDesktop.classList.remove('bg-white/20', 'text-white');
            btnDesktop.classList.add('text-white/60');
        }
        if (btnMobile) {
            btnMobile.classList.add('bg-white/20', 'text-white');
            btnMobile.classList.remove('text-white/60');
        }
    } else {
        wrapper.style.maxWidth = '1024px';
        wrapper.style.borderRadius = '24px';
        wrapper.style.borderWidth = '2px';
        wrapper.style.borderColor = 'rgba(255,255,255,0.2)';
        if (btnDesktop) {
            btnDesktop.classList.add('bg-white/20', 'text-white');
            btnDesktop.classList.remove('text-white/60');
        }
        if (btnMobile) {
            btnMobile.classList.remove('bg-white/20', 'text-white');
            btnMobile.classList.add('text-white/60');
        }
    }
    audio.playChirp('click');
};

// Close modal on Escape
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDevicePreview();
        const settingsDrawer = document.getElementById('settings-drawer');
        if (settingsDrawer) settingsDrawer.classList.add('translate-x-full');
        const mobileDrawer = document.getElementById('mobile-drawer');
        if (mobileDrawer) {
            mobileDrawer.classList.add('opacity-0', 'pointer-events-none');
            document.body.style.overflow = '';
        }
    }
});


// ── 9. Mobile Navigation Drawer ──
(function initMobileDrawer() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('close-mobile-drawer');
    const drawer = document.getElementById('mobile-drawer');
    const links = document.querySelectorAll('.mobile-nav-link');

    if (!mobileBtn || !drawer) return;

    function openDrawer() {
        drawer.classList.remove('opacity-0', 'pointer-events-none');
        drawer.classList.add('opacity-100');
        document.body.style.overflow = 'hidden';
        audio.playChirp('click');
    }

    function closeDrawer() {
        drawer.classList.add('opacity-0', 'pointer-events-none');
        drawer.classList.remove('opacity-100');
        document.body.style.overflow = '';
    }

    mobileBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    links.forEach(l => l.addEventListener('click', closeDrawer));
})();


// ── 10. Theme Settings Drawer & Color Palette ──
const settingsBtn = document.getElementById('settings-btn');
const settingsDrawer = document.getElementById('settings-drawer');
const closeSettingsBtn = document.getElementById('close-settings-btn');

if (settingsBtn && settingsDrawer && closeSettingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDrawer.classList.toggle('translate-x-full');
        audio.playChirp('click');
    });
    closeSettingsBtn.addEventListener('click', () => {
        settingsDrawer.classList.add('translate-x-full');
        audio.playChirp('click');
    });
    document.addEventListener('click', (e) => {
        if (!settingsDrawer.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsDrawer.classList.add('translate-x-full');
        }
    });
}

function setAccentTheme(themeName) {
    const themes = {
        purple: {
            a1: '#7c3aed',
            a2: '#a855f7',
            a3: '#c084fc',
            glow: 'rgba(168, 85, 247, 0.4)',
            glowSubtle: 'rgba(168, 85, 247, 0.15)'
        },
        emerald: {
            a1: '#059669',
            a2: '#10b981',
            a3: '#34d399',
            glow: 'rgba(16, 185, 129, 0.4)',
            glowSubtle: 'rgba(16, 185, 129, 0.15)'
        },
        blue: {
            a1: '#2563eb',
            a2: '#3b82f6',
            a3: '#60a5fa',
            glow: 'rgba(59, 130, 246, 0.4)',
            glowSubtle: 'rgba(59, 130, 246, 0.15)'
        },
        orange: {
            a1: '#ea580c',
            a2: '#f97316',
            a3: '#fb923c',
            glow: 'rgba(249, 115, 22, 0.4)',
            glowSubtle: 'rgba(249, 115, 22, 0.15)'
        }
    };
    const theme = themes[themeName] || themes.purple;
    document.documentElement.style.setProperty('--accent-1', theme.a1);
    document.documentElement.style.setProperty('--accent-2', theme.a2);
    document.documentElement.style.setProperty('--accent-3', theme.a3);
    document.documentElement.style.setProperty('--accent-glow', theme.glow);
    document.documentElement.style.setProperty('--accent-glow-subtle', theme.glowSubtle);
    localStorage.setItem('selected-theme', themeName);

    // Update indicator buttons
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

    audio.playChirp('click');
}

window.setAccentTheme = setAccentTheme;
const savedTheme = localStorage.getItem('selected-theme') || 'purple';
setAccentTheme(savedTheme);


// ── 11. Spotlight Reveal Logic ──
(function initSpotlight() {
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
    const SPOTLIGHT_R = 360;

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX - cachedRect.left;
        mouse.y = e.clientY - cachedRect.top;
    });

    function updateSpotlight() {
        smooth.x += (mouse.x - smooth.x) * 0.1;
        smooth.y += (mouse.y - smooth.y) * 0.1;

        const cw = maskCanvas.width;
        const ch = maskCanvas.height;

        if (cw > 0 && ch > 0) {
            maskCtx.clearRect(0, 0, cw, ch);

            const scaleX = cw / cachedRect.width;
            const scaleY = ch / cachedRect.height;
            const cx = smooth.x * scaleX;
            const cy = smooth.y * scaleY;
            const r = SPOTLIGHT_R * scaleX;

            maskCtx.save();
            maskCtx.translate(cx, cy);
            maskCtx.scale(1.5, 0.85);

            const grad = maskCtx.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.2, 'rgba(255,255,255,0.85)');
            grad.addColorStop(0.6, 'rgba(255,255,255,0.3)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');

            maskCtx.fillStyle = grad;
            maskCtx.beginPath();
            maskCtx.arc(0, 0, r, 0, Math.PI * 2);
            maskCtx.fill();
            maskCtx.restore();

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

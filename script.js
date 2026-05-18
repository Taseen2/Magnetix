const canvas = document.getElementById('filings-canvas');
const ctx = canvas.getContext('2d');
const sparksContainer = document.getElementById('sparks-container');

/**
 * Magnet Objects State
 * Tracks position, velocity, angle, and physical properties for each magnet.
 */
const magnets = [
    { 
        el: document.getElementById('magnet1'), 
        shadow: document.getElementById('shadow1'),
        x: 0, y: 0, angle: 0, 
        vx: 0, vy: 0, va: 0, // Linear and angular velocities
        isDragging: false, isRotating: false,
        baseWidth: 160, baseHeight: 50, scale: 1.0,
        mass: 1.0, strength: 1.0
    },
    { 
        el: document.getElementById('magnet2'), 
        shadow: document.getElementById('shadow2'),
        x: 0, y: 0, angle: 180, 
        vx: 0, vy: 0, va: 0,
        isDragging: false, isRotating: false,
        baseWidth: 160, baseHeight: 50, scale: 1.0,
        mass: 1.0, strength: 1.0
    }
];

let mouseX = 0, mouseY = 0;
let dragOffsetX = 0, dragOffsetY = 0;
let activeMagnet = null;
let ironFilings = [];
let isMouseMagnetActive = false;

// Physics Constants
const FILING_DENSITY = 35;      // Grid spacing for iron filings
const FRICTION = 0.92;          // Linear movement decay
const ANGULAR_FRICTION = 0.85;  // Rotation decay
const BOUNCE = 0.2;            // Energy kept after hitting wall/magnet
const MAGNET_FORCE_BASE = 18000; // Global multiplier for magnetic strength
const MOUSE_MAGNET_STRENGTH = 0.8; // Strength of the virtual cursor magnet

/**
 * Handles window resizing and re-initializes background effects
 */
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initFilings();
}

/**
 * Creates the grid of iron filing points that respond to the magnetic field
 */
function initFilings() {
    ironFilings = [];
    for (let x = 0; x < canvas.width + FILING_DENSITY; x += FILING_DENSITY) {
        for (let y = 0; y < canvas.height + FILING_DENSITY; y += FILING_DENSITY) {
            ironFilings.push({ x, y, angle: 0 });
        }
    }
}

/**
 * Entry point: Sets initial positions and event listeners
 */
function init() {
    resize();
    window.addEventListener('resize', resize);
    
    // Position magnets on opposite sides of the screen
    magnets[0].x = window.innerWidth / 2 - 250;
    magnets[0].y = window.innerHeight / 2;
    magnets[1].x = window.innerWidth / 2 + 250;
    magnets[1].y = window.innerHeight / 2;

    // Toggle for Mouse Magnet
    const toggleBtn = document.getElementById('mouse-magnet-toggle');
    if (toggleBtn) {
        // initialize ARIA state
        toggleBtn.setAttribute('aria-checked', isMouseMagnetActive ? 'true' : 'false');
        toggleBtn.classList.toggle('on', isMouseMagnetActive);
        
        // Click toggles
        toggleBtn.addEventListener('click', () => {
            isMouseMagnetActive = !isMouseMagnetActive;
            toggleBtn.setAttribute('aria-checked', isMouseMagnetActive ? 'true' : 'false');
            toggleBtn.classList.toggle('on', isMouseMagnetActive);
        });

        // Keyboard support
        toggleBtn.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleBtn.click();
            }
        });
    }

    // Interaction Start: Detect clicks on magnets
    window.addEventListener('mousedown', e => {
        magnets.forEach(m => {
            // Convert click to magnet-local coordinates to detect hit
            const dx = e.clientX - m.x;
            const dy = e.clientY - m.y;
            const rad = -m.angle * Math.PI / 180;
            const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
            const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

            // Check if click is inside the magnet rectangle
            if (Math.abs(rx) < (m.baseWidth * m.scale) / 2 && Math.abs(ry) < (m.baseHeight * m.scale) / 2) {
                activeMagnet = m;
                if (e.button === 2) { // Right-Click: Rotate
                    m.isRotating = true;
                } else { // Left-Click: Drag
                    m.isDragging = true;
                    dragOffsetX = rx;
                    dragOffsetY = ry;
                }
                m.el.classList.add('dragging');
            }
        });
    });

    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
        if (activeMagnet) {
            activeMagnet.isDragging = false;
            activeMagnet.isRotating = false;
            activeMagnet.el.classList.remove('dragging');
            activeMagnet = null;
        }
    });

    // Magnet Scaling: Use mouse wheel to change size/mass/strength
    window.addEventListener('wheel', e => {
        magnets.forEach(m => {
            const dx = e.clientX - m.x;
            const dy = e.clientY - m.y;
            // Only scale if mouse is near the magnet
            if (Math.sqrt(dx*dx + dy*dy) < (m.baseWidth * m.scale)) {
                e.preventDefault();
                m.scale = Math.min(3.0, Math.max(0.5, m.scale + (e.deltaY > 0 ? -0.1 : 0.1)));
                m.mass = m.scale * m.scale;           // Mass scales with area
                m.strength = m.scale * m.scale * m.scale; // Strength scales with volume
            }
        });
    }, { passive: false });

    requestAnimationFrame(update);
}

/**
 * Visual Effect: Creates sparks at collision points
 */
function createSparks(x, y) {
    for (let i = 0; i < 10; i++) {
        const spark = document.createElement('div');
        spark.className = 'spark';
        spark.style.left = `${x}px`;
        spark.style.top = `${y}px`;
        const a = Math.random() * Math.PI * 2;
        const d = 20 + Math.random() * 40;
        spark.style.setProperty('--dx', `${Math.cos(a) * d}px`);
        spark.style.setProperty('--dy', `${Math.sin(a) * d}px`);
        sparksContainer.appendChild(spark);
        setTimeout(() => spark.remove(), 600); // Cleanup after animation
    }
}

/**
 * Calculates world coordinates for North and South poles based on magnet center and rotation
 */
function getPoleCoords(m) {
    const rad = m.angle * Math.PI / 180;
    const off = (m.baseWidth * m.scale) / 4;
    return {
        n: { x: m.x - Math.cos(rad) * off, y: m.y - Math.sin(rad) * off },
        s: { x: m.x + Math.cos(rad) * off, y: m.y + Math.sin(rad) * off }
    };
}

/**
 * Collision Optimization: Represents the rectangular magnet as 3 overlapping circles
 * for more accurate collision response and torque (rotation) on impact.
 */
function getCollisionSpheres(m) {
    const rad = m.angle * Math.PI / 180;
    const w = m.baseWidth * m.scale;
    const h = m.baseHeight * m.scale;
    const spheres = [];
    const count = 3; 
    const radius = h / 2;
    const spacing = (w - h) / (count - 1);
    
    for (let i = 0; i < count; i++) {
        const offset = - (w - h) / 2 + i * spacing;
        spheres.push({
            x: m.x + Math.cos(rad) * offset,
            y: m.y + Math.sin(rad) * offset,
            r: radius,
            localX: Math.cos(rad) * offset, // Offset from center for torque
            localY: Math.sin(rad) * offset
        });
    }
    return spheres;
}

/**
 * Main Loop: Handles Rendering and Physics
 */
function update() {
    // Cyberpunk Trail Effect: Fade the background instead of clearing
    ctx.fillStyle = 'rgba(5, 5, 5, 0.2)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // --- 1. RENDER PARTICLES (Cyberpunk Trails) ---
    ctx.lineWidth = 2;
    ironFilings.forEach(f => {
        let fx = 0, fy = 0;
        
        // Add Magnet Forces
        magnets.forEach(m => {
            const poles = getPoleCoords(m);
            const dnx = f.x - poles.n.x, dny = f.y - poles.n.y, dn2 = dnx*dnx + dny*dny + 400;
            const dsx = f.x - poles.s.x, dsy = f.y - poles.s.y, ds2 = dsx*dsx + dsy*dsy + 400;
            const str = MAGNET_FORCE_BASE * m.strength;
            fx += (dnx / Math.sqrt(dn2)) * (str / dn2) - (dsx / Math.sqrt(ds2)) * (str / ds2);
            fy += (dny / Math.sqrt(dn2)) * (str / dn2) - (dsy / Math.sqrt(ds2)) * (str / ds2);
        });

        // CURSOR MAGNETISM: Cursor acts as a South pole (attracts North-aligned filings)
        if (isMouseMagnetActive) {
            const mdx = f.x - mouseX, mdy = f.y - mouseY, md2 = mdx*mdx + mdy*mdy + 1000;
            if (md2 < 400000) { 
                const mstr = MAGNET_FORCE_BASE * MOUSE_MAGNET_STRENGTH;
                fx -= (mdx / Math.sqrt(md2)) * (mstr / md2);
                fy -= (mdy / Math.sqrt(md2)) * (mstr / md2);
            }
        }

        const targetA = Math.atan2(fy, fx);
        let da = targetA - f.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        f.angle += da * 0.15;
        
        // Dynamic color based on force strength (Glow Effect)
        const forceMagnitude = Math.sqrt(fx*fx + fy*fy);
        const brightness = Math.min(100, 30 + forceMagnitude * 500);
        ctx.strokeStyle = `hsla(180, 100%, ${brightness}%, 0.6)`;
        
        ctx.beginPath();
        ctx.moveTo(f.x - Math.cos(f.angle) * 5, f.y - Math.sin(f.angle) * 5);
        ctx.lineTo(f.x + Math.cos(f.angle) * 5, f.y + Math.sin(f.angle) * 5);
        ctx.stroke();
    });

    // --- 2. MAGNETIC ATTRACTION/REPULSION ---
    const [m1, m2] = magnets;
    const p1 = getPoleCoords(m1), p2 = getPoleCoords(m2);

    // Forces between specific poles
    const calcF = (pa, pb, same) => {
        const dx = pb.x - pa.x, dy = pb.y - pa.y, d2 = dx*dx + dy*dy + 800;
        const f = (MAGNET_FORCE_BASE * m1.strength * m2.strength * (same ? -1.3 : 1.0)) / d2;
        const a = Math.atan2(dy, dx);
        return { x: Math.cos(a) * f, y: Math.sin(a) * f };
    };

    const fs = [
        calcF(p1.n, p2.n, true),
        calcF(p1.n, p2.s, false),
        calcF(p1.s, p2.n, false),
        calcF(p1.s, p2.s, true)
    ];

    // --- 3. APPLY PHYSICS TO MAGNETS ---
    magnets.forEach((m, i) => {
        if (m.isDragging) {
            const rad = m.angle * Math.PI / 180;
            const tx = mouseX - (dragOffsetX * Math.cos(rad) - dragOffsetY * Math.sin(rad));
            const ty = mouseY - (dragOffsetX * Math.sin(rad) + dragOffsetY * Math.cos(rad));
            m.vx = (tx - m.x) * 0.3; m.vy = (ty - m.y) * 0.3;
        } else if (m.isRotating) {
            const ta = Math.atan2(mouseY - m.y, mouseX - m.x) * 180 / Math.PI;
            let da = ta - m.angle;
            while (da > 180) da -= 360;
            while (da < -180) da += 360;
            m.angle += da * 0.2;
        } else {
            // Apply magnetic forces
            fs.forEach(f => {
                const mult = i === 0 ? 1 : -1;
                m.vx += (f.x * mult) / m.mass; m.vy += (f.y * mult) / m.mass;
            });

            // CURSOR MAGNETISM: Push/Pull magnets based on proximity
            if (isMouseMagnetActive) {
                const cdx = m.x - mouseX, cdy = m.y - mouseY, cd2 = cdx*cdx + cdy*cdy + 1000;
                if (cd2 < 900000) {
                    const force = (MAGNET_FORCE_BASE * m.strength * MOUSE_MAGNET_STRENGTH * 2) / cd2;
                    const angle = Math.atan2(cdy, cdx);
                    m.vx -= Math.cos(angle) * force / m.mass;
                    m.vy -= Math.sin(angle) * force / m.mass;
                }
            }

            // Calculate Torque
            
            // Calculate Torque
            const myP = i === 0 ? p1 : p2;
            const myF = i === 0 ? fs : fs.map(f => ({ x: -f.x, y: -f.y }));
            const applyT = (p, f) => {
                const rx = p.x - m.x, ry = p.y - m.y;
                m.va += (rx * f.y - ry * f.x) * 0.0003 / m.mass;
            };
            applyT(myP.n, myF[0]); applyT(myP.n, myF[1]); applyT(myP.s, myF[2]); applyT(myP.s, myF[3]);
            
            m.vx *= FRICTION; m.vy *= FRICTION; m.va *= ANGULAR_FRICTION;
        }
        
        // Update positions
        m.x += m.vx; m.y += m.vy; m.angle += m.va;

        // Wall Bounds
        const w = m.baseWidth * m.scale, h = m.baseHeight * m.scale;
        if (m.x < w/2) { m.x = w/2; m.vx *= -BOUNCE; }
        if (m.x > canvas.width - w/2) { m.x = canvas.width - w/2; m.vx *= -BOUNCE; }
        if (m.y < h/2) { m.y = h/2; m.vy *= -BOUNCE; }
        if (m.y > canvas.height - h/2) { m.y = canvas.height - h/2; m.vy *= -BOUNCE; }

        // Update DOM elements
        m.el.style.width = `${w}px`; m.el.style.height = `${h}px`;
        m.el.style.transform = `translate(${m.x - w/2}px, ${m.y - h/2}px) rotate(${m.angle}deg)`;
        m.shadow.style.width = `${w}px`; m.shadow.style.height = `${h}px`;
        m.shadow.style.transform = `translate(${m.x - w/2 + 10}px, ${m.y - h/2 + 15}px) rotate(${m.angle}deg)`;
    });

    // --- 4. COLLISION DETECTION (Magnet vs Magnet) ---
    const s1 = getCollisionSpheres(m1);
    const s2 = getCollisionSpheres(m2);
    
    let collided = false;
    let totalPushX = 0, totalPushY = 0;

    s1.forEach(c1 => {
        s2.forEach(c2 => {
            const dx = c2.x - c1.x;
            const dy = c2.y - c1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = c1.r + c2.r;

            if (dist < minDist) {
                collided = true;
                const angle = Math.atan2(dy, dx);
                const overlap = minDist - dist;
                
                totalPushX += Math.cos(angle) * overlap * 0.5;
                totalPushY += Math.sin(angle) * overlap * 0.5;
                
                const relativeVX = m2.vx - m1.vx;
                const relativeVY = m2.vy - m1.vy;
                const velAlongNormal = relativeVX * Math.cos(angle) + relativeVY * Math.sin(angle);

                if (velAlongNormal < 0) {
                    const j = -(1 + BOUNCE) * velAlongNormal / (1/m1.mass + 1/m2.mass);
                    const impulseX = j * Math.cos(angle);
                    const impulseY = j * Math.sin(angle);
                    
                    if (!m1.isDragging) {
                        m1.vx -= impulseX / m1.mass;
                        m1.vy -= impulseY / m1.mass;
                        m1.va -= (c1.localX * impulseY - c1.localY * impulseX) * 0.005 / m1.mass;
                    }
                    if (!m2.isDragging) {
                        m2.vx += impulseX / m2.mass;
                        m2.vy += impulseY / m2.mass;
                        m2.va += (c2.localX * impulseY - c2.localY * impulseX) * 0.005 / m2.mass;
                    }
                    
                    if (Math.abs(velAlongNormal) > 5) {
                        createSparks((c1.x + c2.x) / 2, (c1.y + c2.y) / 2);
                    }
                }
            }
        });
    });

    if (collided) {
        if (!m1.isDragging) { m1.x -= totalPushX; m1.y -= totalPushY; }
        if (!m2.isDragging) { m2.x += totalPushX; m2.y += totalPushY; }
    }

    requestAnimationFrame(update);
}

// Start the simulation
init();

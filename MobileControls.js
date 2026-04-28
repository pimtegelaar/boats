// MobileControls.js
// Exposes virtual joystick setup for mobile/touch controls via window.MobileControls
(function() {
    function setupJoystick() {
        const container = document.getElementById('joystick-container');
        const knob      = document.getElementById('joystick-knob');

        if (!container || !knob) return;

        const BASE_RADIUS  = 60;  // half the container width
        const KNOB_RADIUS  = 24;  // half the knob width
        const MAX_TRAVEL   = BASE_RADIUS - KNOB_RADIUS; // px knob centre can travel from base centre
        const DEAD_ZONE    = 0.15; // fraction of MAX_TRAVEL before input registers

        let activeTouchId = null;
        let baseX = 0, baseY = 0; // page-coords of container centre at touch-start

        // Joystick axis values in [-1, 1]
        const joystickAxis = { x: 0, y: 0 };

        function getContainerCentre() {
            const r = container.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }

        function applyAxis(ax, ay) {
            joystickAxis.x = ax;
            joystickAxis.y = ay;

            // Map to WASD keys
            const threshold = DEAD_ZONE;
            window.keys = window.keys || {};
            window.keys['w'] = ay < -threshold;
            window.keys['s'] = ay >  threshold;
            window.keys['a'] = ax < -threshold;
            window.keys['d'] = ax >  threshold;
        }

        function resetJoystick() {
            if (activeTouchId !== null) {
                window.joystickTouchIds && window.joystickTouchIds.delete(activeTouchId);
            }
            activeTouchId = null;
            applyAxis(0, 0);
            knob.style.transform = 'translate(-50%, -50%)';
        }

        function onTouchStart(e) {
            if (container.style.display === 'none' || container.style.display === '') {
                container.style.display = 'block';
            }
            if (activeTouchId !== null) return;
            for (const t of e.changedTouches) {
                const c = getContainerCentre();
                const dx = t.clientX - c.x;
                const dy = t.clientY - c.y;
                if (Math.sqrt(dx * dx + dy * dy) <= BASE_RADIUS * 1.4) {
                    activeTouchId = t.identifier;
                    window.joystickTouchIds = window.joystickTouchIds || new Set();
                    window.joystickTouchIds.add(activeTouchId);
                    baseX = c.x;
                    baseY = c.y;
                    e.preventDefault();
                    break;
                }
            }
        }

        function onTouchMove(e) {
            if (activeTouchId === null) return;
            for (const t of e.changedTouches) {
                if (t.identifier !== activeTouchId) continue;
                let dx = t.clientX - baseX;
                let dy = t.clientY - baseY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > MAX_TRAVEL) {
                    dx = (dx / dist) * MAX_TRAVEL;
                    dy = (dy / dist) * MAX_TRAVEL;
                }
                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                applyAxis(dx / MAX_TRAVEL, dy / MAX_TRAVEL);
                e.preventDefault();
                break;
            }
        }

        function onTouchEnd(e) {
            for (const t of e.changedTouches) {
                window.joystickTouchIds && window.joystickTouchIds.delete(t.identifier);
                if (t.identifier === activeTouchId) {
                    resetJoystick();
                    break;
                }
            }
        }

        container.addEventListener('touchstart',  onTouchStart, { passive: false });
        window.addEventListener('touchmove',   onTouchMove,  { passive: false });
        window.addEventListener('touchend',    onTouchEnd,   { passive: false });
        window.addEventListener('touchcancel', onTouchEnd,   { passive: false });

        // On pointer-coarse (touch) devices show the joystick immediately
        if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
            container.style.display = 'block';
        }

        // Expose joystick state for debugging or external use
        window.MobileControls = {
            joystickAxis,
            resetJoystick,
            show: () => { container.style.display = 'block'; },
            hide: () => { container.style.display = 'none'; }
        };
    }

    // Auto-setup on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupJoystick);
    } else {
        setupJoystick();
    }
})();

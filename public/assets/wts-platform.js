(function () {
    const ICONS = {
        home:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 7L8 2.5 13.5 7v6a1 1 0 01-1 1H3.5a1 1 0 01-1-1V7z"/><path d="M6.5 14V9.5h3V14"/></svg>',
        plus:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v10M3 8h10"/></svg>',
        edit:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z"/><path d="M9.5 4l2.5 2.5"/></svg>',
        chart:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 13.5h11"/><path d="M4 11V8M7 11V5M10 11V7M13 11V4"/></svg>',
        card:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="4" width="12" height="9" rx="1.2"/><path d="M2 7h12"/></svg>',
        cog:       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
        help:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M6.5 6.5a1.5 1.5 0 113 0c0 .8-.7 1.2-1.5 1.5v1M8 11h.01" stroke-linecap="round"/></svg>',
        book:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3h10v10H3z"/><path d="M3 3v10M8 3v10"/></svg>',
        search:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.5"/><path d="M10.3 10.3L14 14" stroke-linecap="round"/></svg>',
        globe:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/></svg>',
        mic:       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="2" width="4" height="8" rx="2"/><path d="M3.5 8a4.5 4.5 0 009 0M8 12.5v2M5.5 14.5h5"/></svg>',
        download:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2v8M4.5 7L8 10.5 11.5 7M2.5 13.5h11"/></svg>',
        check:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l3.5 3.5L13 5"/></svg>',
    };

    const MAIN_NAV = [
        { key: 'sites',   href: '/dashboard.html', label: 'Sites',     icon: 'home' },
        { key: 'create',  href: '/app.html',       label: 'New site',  icon: 'plus' },
        { key: 'domains', href: '/domains.html',   label: 'Domains',   icon: 'globe' },
    ];

    const ACCOUNT_NAV = [
        { key: 'usage',   href: '/usage.html',   label: 'Usage',    icon: 'chart' },
        { key: 'billing', href: '/billing.html', label: 'Billing',  icon: 'card' },
        { key: 'profile', href: '/profile.html', label: 'Settings', icon: 'cog' },
        { key: 'pricing', href: '/pricing.html', label: 'Plans',    icon: 'chart' },
    ];

    const HELP_NAV = [
        { key: 'docs',      href: '/docs.html',      label: 'Docs',      icon: 'book' },
        { key: 'changelog', href: '/changelog.html', label: 'Changelog', icon: 'help' },
    ];

    function renderLinks(items, active) {
        return items.map(i => `
            <a class="wts-side-link ${active === i.key ? 'active' : ''}" href="${i.href}">
                <span class="ico">${ICONS[i.icon]}</span>
                <span>${i.label}</span>
                ${i.key === 'sites' ? '<span class="count" id="sidebarCount"></span>' : ''}
            </a>
        `).join('');
    }

    function sidebarHTML(active) {
        return `
            <aside class="wts-side">
                <a class="wts-side-brand" href="/dashboard.html" style="text-decoration:none;">
                    <div class="wts-mark">w</div>
                    <span class="wts-wordmark">word<span class="arrow">→</span>site</span>
                </a>

                <div class="wts-side-section" style="padding-top:12px;">
                    ${renderLinks(MAIN_NAV, active)}
                </div>

                <div class="wts-side-section">
                    <div class="wts-side-section-label">Account</div>
                    ${renderLinks(ACCOUNT_NAV, active)}
                </div>

                <div class="wts-side-section">
                    <div class="wts-side-section-label">Help</div>
                    ${renderLinks(HELP_NAV, active)}
                </div>

                <div class="wts-side-foot" style="position:relative;">
                    <button id="userMenuBtn" class="wts-side-user" style="width:100%; text-align:left;">
                        <div class="wts-avatar" id="userAvatar">?</div>
                        <div style="flex:1; min-width:0;">
                            <div class="name" id="userName">Account</div>
                            <div class="email" id="userEmail"></div>
                        </div>
                        <span style="color:var(--muted-2);">▾</span>
                    </button>
                    <div class="user-dropdown" id="userDropdown">
                        <a href="/profile.html">Profile</a>
                        <a href="/billing.html">Billing</a>
                        <a href="/usage.html">Usage</a>
                        <a href="/domains.html">Domains</a>
                        <div class="divider"></div>
                        <button class="danger" id="logoutBtn">Log out</button>
                    </div>
                </div>
            </aside>
        `;
    }

    function injectSharedStyles() {
        if (document.getElementById('wts-platform-styles')) return;
        const style = document.createElement('style');
        style.id = 'wts-platform-styles';
        style.textContent = `
            html, body { height: 100%; margin: 0; }
            .wts-shell { display: flex; height: 100vh; overflow: hidden; }
            .wts-shell-main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
            .wts-content { flex: 1; overflow: auto; }
            .wts-side-brand { padding: 20px 22px 18px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--line); }
            .user-dropdown { display: none; position: absolute; left: 14px; right: 14px; bottom: 68px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow-md); overflow: hidden; z-index: 200; }
            .user-dropdown.open { display: block; }
            .user-dropdown a, .user-dropdown button { display: block; width: 100%; padding: 9px 14px; font-size: 13px; color: var(--ink); text-align: left; background: none; border: 0; cursor: pointer; }
            .user-dropdown a:hover, .user-dropdown button:hover { background: var(--bg-2); }
            .user-dropdown .danger { color: var(--danger); }
            .user-dropdown .divider { height: 1px; background: var(--line); margin: 4px 0; }
            .wts-side-user { background: none; border: 0; cursor: pointer; font: inherit; color: inherit; }
            .account-subnav { border-bottom: 1px solid var(--line); background: var(--bg); position: sticky; top: 0; z-index: 5; }
            .account-subnav-inner { display: flex; gap: 0; padding: 0 36px; }
            .account-subnav a { padding: 14px 16px; font-size: 13.5px; font-weight: 500; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px; text-decoration: none; }
            .account-subnav a.active { color: var(--ink); border-bottom-color: var(--ink); }
            .account-subnav a:hover { color: var(--ink); }
        `;
        document.head.appendChild(style);
    }

    function initials(s) {
        return (s || '?')
            .split(/[\s@]/)
            .map(w => w[0]?.toUpperCase())
            .filter(Boolean)
            .slice(0, 2)
            .join('') || '?';
    }

    async function fetchUser() {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
            const redirect = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login.html?redirect=${redirect}`;
            throw new Error('not-authed');
        }
        const data = await res.json();
        return data.user;
    }

    function wireUserUI(user) {
        const $ = id => document.getElementById(id);
        const inits = initials(user.displayName || user.email);
        const name = user.displayName || (user.email || '').split('@')[0] || 'Account';
        if ($('userAvatar')) $('userAvatar').textContent = inits;
        if ($('userName')) $('userName').textContent = name;
        if ($('userEmail')) $('userEmail').textContent = user.email || '';
        if ($('crumbUser')) $('crumbUser').textContent = name;

        const btn = $('userMenuBtn'), dd = $('userDropdown');
        if (btn && dd) {
            btn.addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
            document.addEventListener('click', () => dd.classList.remove('open'));
        }
        const logout = $('logoutBtn');
        if (logout) logout.addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }

    function renderSidebar(active) {
        injectSharedStyles();
        const mount = document.getElementById('wts-sidebar-mount');
        if (!mount) return;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = sidebarHTML(active);
        mount.replaceWith(wrapper.firstElementChild);
    }

    window.WtsPlatform = {
        ICONS,
        renderSidebar,
        async init({ active }) {
            renderSidebar(active);
            const user = await fetchUser();
            wireUserUI(user);
            return user;
        },
        initials,
    };
})();

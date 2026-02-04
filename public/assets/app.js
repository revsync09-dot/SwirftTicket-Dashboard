const dash = (() => {
  const api = async (path, options = {}) => {
    const opts = {
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    };
    if (options.body && typeof options.body !== 'string') {
      opts.body = JSON.stringify(options.body);
    }
    const res = await fetch(path, opts);
    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(data && data.error ? data.error : 'request_failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));
  const setText = (sel, value) => {
    const el = qs(sel);
    if (el) el.textContent = value;
  };

  const formatGuildStatus = (status) => {
    if (status === 'installed') return { label: 'Installed', cls: 'open' };
    return { label: 'Not Installed', cls: 'claimed' };
  };

  const loadDashboardData = (guildId) => {
    const query = guildId ? `?guild_id=${encodeURIComponent(guildId)}` : '';
    return api(`/api/dashboard-data${query}`);
  };

  const handleAuthError = () => {
    window.location.href = '/login';
  };

  const formatRelative = (iso) => {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return {
    api,
    qs,
    qsa,
    setText,
    formatGuildStatus,
    loadDashboardData,
    handleAuthError,
    formatRelative,
  };
})();

const initTheme = () => {
  const root = document.documentElement;
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  root.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');

  dash.qsa('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  });
};

const initLogin = () => {
  const button = dash.qs('[data-login]');
  if (button) {
    button.addEventListener('click', () => {
      window.location.href = '/auth/login';
    });
  }
};

const initServers = async () => {
  try {
    const data = await dash.loadDashboardData();
    dash.setText('[data-bot-tag]', data.botTag || 'SwiftTicket');

    const container = dash.qs('[data-guild-list]');
    if (!container) return;
    container.innerHTML = '';

    (data.guilds || []).forEach((g) => {
      const status = dash.formatGuildStatus(g.status);
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `
        <div>
          <div style="font-weight: 600;">${g.name}</div>
          <div class="mono" style="color: var(--muted);">${g.id}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="status ${status.cls}">${status.label}</span>
          ${g.status === 'installed'
            ? `<a class="btn" href="/select/${g.id}">Select</a>`
            : `<a class="btn secondary" href="/invite/${g.id}">Invite</a>`}
        </div>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    if (err.status === 401) return dash.handleAuthError();
    dash.setText('[data-error]', 'Could not load servers.');
  }
};

const initDashboard = async () => {
  const modal = dash.qs('[data-ticket-modal]');
  const closeBtn = dash.qs('[data-modal-close]');
  const refreshBtn = dash.qs('[data-refresh-table]');

  const closeModal = () => {
    if (modal) modal.classList.remove('open');
  };
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  const renderTable = (tickets) => {
    const table = dash.qs('[data-ticket-table] tbody');
    if (!table) return;
    table.innerHTML = '';
    tickets.forEach((t) => {
      const status = (t.status || 'OPEN').toLowerCase();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="status ${status}">${status}</span></td>
        <td>TK-${t.id}</td>
        <td class="mono">${t.creator_id || '-'}</td>
        <td>${t.category_name || 'General'}</td>
        <td>${dash.formatRelative(t.created_at)}</td>
        <td><button class="btn ghost" data-view="${t.id}">View</button></td>
      `;
      tr.querySelector('[data-view]')?.addEventListener('click', () => {
        dash.setText('[data-modal-title]', `TK-${t.id}`);
        dash.setText('[data-modal-status]', status);
        dash.setText('[data-modal-user]', t.creator_id || '-');
        dash.setText('[data-modal-created]', new Date(t.created_at || '').toLocaleString());
        dash.setText('[data-modal-category]', t.category_name || 'General');
        dash.setText('[data-modal-message]', t.query_text || '');
        if (modal) modal.classList.add('open');
      });
      table.appendChild(tr);
    });
  };

  const load = async () => {
    try {
      const data = await dash.loadDashboardData();
      const guildName = (data.guilds || []).find((g) => g.id === data.selectedGuild)?.name || 'Select a server';
      dash.setText('[data-selected-guild]', guildName);

      const metrics = data.metrics || {};
      dash.setText('[data-total]', metrics.totalTickets || 0);
      dash.setText('[data-open]', metrics.openTickets || 0);
      dash.setText('[data-closed]', metrics.closedToday || 0);
      dash.setText('[data-avg-resolution]', `${metrics.avgResolutionMin || 0}m`);
      dash.setText('[data-avg-response]', `${metrics.avgResponseMin || 0}m`);

      const recent = dash.qs('[data-recent-list]');
      if (recent) {
        recent.innerHTML = '';
        (data.recentTickets || []).slice(0, 5).forEach((t) => {
          const status = t.status ? t.status.toLowerCase() : 'open';
          const item = document.createElement('div');
          item.className = 'list-item';
          item.innerHTML = `
            <div>
              <div style="font-weight: 600;">TK-${t.id}</div>
              <div class="small">${t.category_name || 'General'}  ${dash.formatRelative(t.created_at)}</div>
            </div>
            <span class="status ${status}">${status}</span>
          `;
          recent.appendChild(item);
        });
      }

      renderTable(data.recentTickets || []);
      dash.setText('[data-last-updated]', 'just now');
    } catch (err) {
      if (err.status === 401) return dash.handleAuthError();
    }
  };

  if (refreshBtn) refreshBtn.addEventListener('click', load);
  await load();
};

const initSetup = async () => {
  const form = dash.qs('[data-settings-form]');
  const categoryForm = dash.qs('[data-category-form]');
  const categoryList = dash.qs('[data-category-list]');
  const refreshBtn = dash.qs('[data-refresh]');
  const postPanelBtn = dash.qs('[data-post-panel]');
  const postPanelsetBtn = dash.qs('[data-post-panelset]');
  const channelInput = dash.qs('[data-panel-channel]');
  let currentGuild = null;

  const renderCategories = (categories) => {
    if (!categoryList) return;
    categoryList.innerHTML = '';
    if (!categories || !categories.length) {
      categoryList.innerHTML = '<div class="notice">No categories yet. Add one below.</div>';
      return;
    }
    categories.forEach((cat) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div>
          <div style="font-weight: 600;">${cat.name}</div>
          <div class="small">${cat.description || 'No description'}</div>
          <div class="mono small">ID ${cat.id}</div>
        </div>
        <button class="btn ghost" data-delete="${cat.id}">Delete</button>
      `;
      categoryList.appendChild(item);
    });

    dash.qsa('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const categoryId = btn.getAttribute('data-delete');
        await dash.api('/api/categories', {
          method: 'DELETE',
          body: { guild_id: currentGuild, category_id: categoryId },
        });
        await load();
      });
    });
  };

  const load = async () => {
    try {
      const data = await dash.loadDashboardData();
      currentGuild = data.selectedGuild;
      if (!currentGuild) {
        dash.setText('[data-setup-error]', 'Select a server first.');
        return;
      }
      dash.setText('[data-guild-id]', currentGuild);

      const settings = data.settings || {};
      if (form) {
        form.ticket_parent_channel_id.value = settings.ticket_parent_channel_id || '';
        form.staff_role_id.value = settings.staff_role_id || '';
        form.timezone.value = settings.timezone || 'UTC';
        form.category_slots.value = settings.category_slots || 1;
        form.warn_threshold.value = settings.warn_threshold || 3;
        form.warn_timeout_minutes.value = settings.warn_timeout_minutes || 10;
        form.enable_smart_replies.checked = !!settings.enable_smart_replies;
        form.enable_ai_suggestions.checked = !!settings.enable_ai_suggestions;
        form.enable_auto_priority.checked = !!settings.enable_auto_priority;
      }
      renderCategories(data.categories || []);
    } catch (err) {
      if (err.status === 401) return dash.handleAuthError();
      dash.setText('[data-setup-error]', 'Unable to load settings.');
    }
  };

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentGuild) return;
      const payload = {
        guild_id: currentGuild,
        ticket_parent_channel_id: form.ticket_parent_channel_id.value.trim(),
        staff_role_id: form.staff_role_id.value.trim(),
        timezone: form.timezone.value.trim() || 'UTC',
        category_slots: Number(form.category_slots.value || 1),
        warn_threshold: Number(form.warn_threshold.value || 3),
        warn_timeout_minutes: Number(form.warn_timeout_minutes.value || 10),
        enable_smart_replies: form.enable_smart_replies.checked,
        enable_ai_suggestions: form.enable_ai_suggestions.checked,
        enable_auto_priority: form.enable_auto_priority.checked,
      };
      try {
        await dash.api('/api/settings', { method: 'POST', body: payload });
        dash.setText('[data-setup-error]', 'Saved.');
      } catch (err) {
        dash.setText('[data-setup-error]', err?.data?.error || 'Save failed.');
      }
    });
  }

  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentGuild) return;
      const name = categoryForm.category_name.value.trim();
      const desc = categoryForm.category_description.value.trim();
      if (!name) return;
      try {
        await dash.api('/api/categories', {
          method: 'POST',
          body: { guild_id: currentGuild, name, description: desc || null },
        });
        categoryForm.reset();
        await load();
      } catch (err) {
        dash.setText('[data-setup-error]', err?.data?.error || 'Category create failed.');
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', load);
  }

  if (postPanelBtn) {
    postPanelBtn.addEventListener('click', async () => {
      if (!currentGuild) return;
      const channel = channelInput.value.trim();
      if (!/^\d+$/.test(channel)) {
        dash.setText('[data-setup-error]', 'Please enter a numeric channel ID.');
        return;
      }
      try {
        await dash.api('/api/post-panel', {
          method: 'POST',
          body: { guild_id: currentGuild, channel_id: channel },
        });
        dash.setText('[data-setup-error]', 'Panel posted.');
      } catch (err) {
        dash.setText('[data-setup-error]', err?.data?.error || 'Panel post failed.');
      }
    });
  }

  if (postPanelsetBtn) {
    postPanelsetBtn.addEventListener('click', async () => {
      if (!currentGuild) return;
      const channel = channelInput.value.trim();
      if (!/^\d+$/.test(channel)) {
        dash.setText('[data-setup-error]', 'Please enter a numeric channel ID.');
        return;
      }
      try {
        await dash.api('/api/post-panelset', {
          method: 'POST',
          body: { guild_id: currentGuild, channel_id: channel },
        });
        dash.setText('[data-setup-error]', 'Public panel posted.');
      } catch (err) {
        dash.setText('[data-setup-error]', err?.data?.error || 'Public panel failed.');
      }
    });
  }

  await load();
};

initTheme();
const page = document.body.getAttribute('data-page');
if (page === 'login') initLogin();
if (page === 'servers') initServers();
if (page === 'dashboard') initDashboard();
if (page === 'setup') initSetup();

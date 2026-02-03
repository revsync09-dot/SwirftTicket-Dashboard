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
    if (status === 'installed') return { label: 'Installed', cls: 'good' };
    return { label: 'Not Installed', cls: 'warn' };
  };

  const loadDashboardData = (guildId) => {
    const query = guildId ? `?guild_id=${encodeURIComponent(guildId)}` : '';
    return api(`/api/dashboard-data${query}`);
  };

  const handleAuthError = () => {
    window.location.href = '/login';
  };

  return {
    api,
    qs,
    qsa,
    setText,
    formatGuildStatus,
    loadDashboardData,
    handleAuthError,
  };
})();

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
      row.className = 'card';
      row.innerHTML = `
        <div class="flex" style="justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600;">${g.name}</div>
            <div class="mono" style="color: var(--muted);">${g.id}</div>
          </div>
          <span class="badge ${status.cls}">${status.label}</span>
        </div>
        <div class="flex" style="margin-top: 12px;">
          ${g.status === 'installed'
            ? `<a class="button" href="/select/${g.id}">Select</a>`
            : `<a class="button warning" href="/invite/${g.id}">Invite Bot</a>`}
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
  try {
    const data = await dash.loadDashboardData();
    dash.setText('[data-bot-tag]', data.botTag || 'SwiftTicket');
    dash.setText('[data-uptime]', data.uptime || 'offline');
    dash.setText('[data-latency]', `${data.latencyMs || 0} ms`);

    if (data.selectedGuild) {
      dash.setText('[data-selected-guild]', data.selectedGuild);
    }

    const invite = dash.qs('[data-invite]');
    if (invite && data.inviteUrl) {
      invite.href = data.inviteUrl;
      invite.style.display = 'inline-flex';
    }
  } catch (err) {
    if (err.status === 401) return dash.handleAuthError();
  }
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
      item.className = 'card';
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; gap: 12px;">
          <div>
            <div style="font-weight: 600;">${cat.name}</div>
            <div style="color: var(--muted);">${cat.description || 'No description'}</div>
            <div class="mono" style="color: var(--muted); margin-top: 6px;">ID ${cat.id}</div>
          </div>
          <button class="button ghost" data-delete="${cat.id}">Delete</button>
        </div>
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
      await dash.api('/api/settings', { method: 'POST', body: payload });
      dash.setText('[data-setup-error]', 'Saved.');
    });
  }

  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentGuild) return;
      const name = categoryForm.category_name.value.trim();
      const desc = categoryForm.category_description.value.trim();
      if (!name) return;
      await dash.api('/api/categories', {
        method: 'POST',
        body: { guild_id: currentGuild, name, description: desc || null },
      });
      categoryForm.reset();
      await load();
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
      await dash.api('/api/post-panel', {
        method: 'POST',
        body: { guild_id: currentGuild, channel_id: channel },
      });
      dash.setText('[data-setup-error]', 'Panel posted.');
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
      await dash.api('/api/post-panelset', {
        method: 'POST',
        body: { guild_id: currentGuild, channel_id: channel },
      });
      dash.setText('[data-setup-error]', 'Public panel posted.');
    });
  }

  await load();
};

const page = document.body.getAttribute('data-page');
if (page === 'login') initLogin();
if (page === 'servers') initServers();
if (page === 'dashboard') initDashboard();
if (page === 'setup') initSetup();

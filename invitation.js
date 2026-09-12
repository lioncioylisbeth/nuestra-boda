(function () {
  'use strict';
  const core = window.WeddingCore;
  const $ = id => document.getElementById(id);
  const storage = {
    get(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch (_) { /* Private browsing: keep the UI usable. */ } }
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function scrollToElement(element) { element.scrollIntoView({behavior:reducedMotion ? 'auto' : 'smooth', block:'start'}); }

  // Keep all four appearances, without a horizontally clipped floating toolbar.
  window.setSkin = function (skin, initializing) {
    if (!['azul', 'claro', 'gris', 'blanco'].includes(skin)) skin = 'azul';
    document.body.classList.remove('theme-claro', 'theme-gris', 'theme-blanco');
    if (skin !== 'azul') document.body.classList.add('theme-' + skin);
    ['azul', 'claro', 'gris', 'blanco'].forEach(name => {
      const button = $('skin-btn-' + name);
      button.setAttribute('aria-pressed', String(name === skin));
      button.classList.remove('gold-gradient-bg');
    });
    try { localStorage.setItem('wedding-skin', skin); } catch (_) { /* Optional preference. */ }
    $('appearance-menu').open = false;
    if (!initializing) $('appearance-menu').querySelector('summary').focus();
    document.querySelector('meta[name="theme-color"]').content = ({azul:'#061126', claro:'#ffffff', gris:'#101116', blanco:'#faf7ef'})[skin];
  };
  let savedSkin = 'azul';
  try { savedSkin = localStorage.getItem('wedding-skin') || 'azul'; } catch (_) { /* Default palette. */ }
  window.setSkin(savedSkin, true);
  document.addEventListener('click', event => {
    if (!$('appearance-menu').contains(event.target)) $('appearance-menu').open = false;
  });

  // Accessible dialogs: focus remains inside; background is inert while open.
  let activeDialog = null, returnFocus = null, previousOverflow = '';
  const inertState = new Map();
  function closeDialog() {
    if (!activeDialog) return;
    activeDialog.hidden = true;
    if (activeDialog.id === 'welcome-gate') activeDialog.classList.add('hidden');
    inertState.forEach((value, element) => { element.inert = value; });
    inertState.clear();
    document.body.style.overflow = previousOverflow;
    activeDialog = null;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  }
  function openDialog(dialog) {
    if (activeDialog) closeDialog();
    returnFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    activeDialog = dialog;
    for (const child of document.body.children) {
      if (child !== dialog && !['SCRIPT','STYLE'].includes(child.tagName)) { inertState.set(child, child.inert); child.inert = true; }
    }
    dialog.hidden = false;
    dialog.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    dialog.classList.add('flex');
    document.body.style.overflow = 'hidden';
    dialog.querySelector('button, input, [tabindex="0"]')?.focus();
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      $('appearance-menu').open = false;
      if (activeDialog?.id === 'welcome-gate') window.enterWithoutMusic();
      else closeDialog();
    }
    if (event.key !== 'Tab' || !activeDialog) return;
    const nodes = [...activeDialog.querySelectorAll('button, a[href], input, textarea, select, [tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.toggleChat = function () {
    if (activeDialog === $('chat-modal')) closeDialog();
    else { openDialog($('chat-modal')); $('chat-card').classList.remove('scale-95'); $('chat-input').focus(); }
  };
  $('chat-modal').addEventListener('click', event => { if (event.target === $('chat-modal')) closeDialog(); });
  $('chat-messages').setAttribute('role', 'log');
  $('chat-messages').setAttribute('aria-live', 'polite');

  // Autoplay is attempted, but browser consent and the guest's pause are respected.
  const audio = $('bg-audio');
  audio.volume = .35;
  audio.autoplay = false;
  function syncAudio() {
    const playing = !audio.paused;
    $('play-icon').className = playing ? 'fa-solid fa-pause text-sm' : 'fa-solid fa-play text-sm ml-0.5';
    $('play-btn').setAttribute('aria-label', playing ? 'Pausar música' : 'Reproducir música');
    $('play-btn').setAttribute('aria-pressed', String(playing));
    $('play-btn').title = playing ? 'Pausar música' : 'Reproducir música';
  }
  audio.addEventListener('play', syncAudio);
  audio.addEventListener('pause', syncAudio);
  audio.addEventListener('error', syncAudio);
  function playMusic() {
    storage.set('wedding-music-paused', 'no');
    return audio.play().catch(() => window.showNotification('No se pudo iniciar la música. Puedes volver a intentarlo con el botón de reproducción.', true));
  }
  window.toggleAudio = function () {
    if (audio.paused) playMusic();
    else { storage.set('wedding-music-paused', 'yes'); audio.pause(); }
  };
  window.enterInvitation = function () {
    storage.set('wedding-entered', 'yes');
    closeDialog();
    playMusic();
  };
  window.enterWithoutMusic = function () {
    storage.set('wedding-entered', 'yes');
    storage.set('wedding-music-paused', 'yes');
    audio.pause();
    closeDialog();
  };
  if (storage.get('wedding-music-paused') === 'yes') audio.pause();
  else audio.play().catch(error => {
    if (error.name === 'NotAllowedError' && storage.get('wedding-entered') !== 'yes') openDialog($('welcome-gate'));
  });
  syncAudio();

  document.querySelectorAll('[data-calendar]').forEach(button => {
    button.addEventListener('click', () => {
      const kind = button.dataset.calendar;
      const url = URL.createObjectURL(new Blob([core.calendar(kind)], {type:'text/calendar;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url; link.download = 'boda-lioncio-lisbeth-' + kind + '.ics';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      window.showNotification('Archivo de calendario preparado. Ábrelo para agregar el evento.');
    });
  });
  window.useToastInRSVP = function () {
    if (!window.lastGeneratedToastText) return;
    $('message').value = window.lastGeneratedToastText;
    $('dedication-tools').open = false;
    $('message').focus();
    window.showNotification('Dedicatoria añadida. Puedes editarla antes de confirmar.');
  };

  let previousCounts = [1, 0];
  window.updateGuestTotal = function () {
    const adults = $('adults').valueAsNumber, children = $('children').valueAsNumber;
    const total = Number.isFinite(adults + children) ? adults + children : 0;
    $('passes').value = total;
    $('passes-total').textContent = total + (total === 1 ? ' persona' : ' personas');
  };
  window.syncAttendanceCounts = function () {
    const notComing = $('attendance').value === core.NO;
    if (notComing && !$('adults').disabled) previousCounts = [$('adults').value, $('children').value];
    if (!notComing && $('adults').disabled) { $('adults').value = previousCounts[0]; $('children').value = previousCounts[1]; }
    ['adults', 'children'].forEach(id => {
      $(id).disabled = notComing;
      if (notComing) $(id).value = 0;
      $(id).setCustomValidity('');
    });
    window.updateGuestTotal();
  };
  window.syncAttendanceCounts();

  const attempts = new Map();
  let busy = false;
  async function fingerprint(data) {
    if (!window.crypto?.subtle) return null;
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
    return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  }
  function requestId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'rsvp-' + Date.now().toString(36) + '-' + [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2,'0')).join('');
  }
  function setSaveState(state) {
    const messages = {
      pending:'Estamos comprobando el registro. Puedes revisar tu respuesta mientras tanto.',
      saved:'Registro verificado en la hoja de confirmaciones. Falta enviar tu mensaje por WhatsApp.',
      unknown:'No pudimos verificar el guardado en la hoja. No lo daremos por confirmado ni lo reenviaremos automáticamente para evitar duplicados. Envía tu respuesta por WhatsApp para que los novios puedan revisarla.',
      rejected:'La hoja no aceptó el registro. Tus datos siguen aquí; envía tu respuesta por WhatsApp para que los novios puedan revisarla.'
    };
    $('rsvp-save-state').dataset.state = state;
    $('rsvp-save-state').textContent = messages[state] || messages.unknown;
  }
  function showSummary(data, state) {
    ['name','phone','attendance','adults','children'].forEach(key => { $('summary-' + key).textContent = data[key]; });
    $('summary-total').textContent = data.passes + (data.passes === 1 ? ' persona' : ' personas');
    $('summary-message').textContent = data.message;
    $('summary-message').hidden = !data.message;
    $('rsvp-whatsapp').href = core.whatsappURL(data);
    $('rsvp-form').hidden = true;
    $('rsvp-summary').hidden = false;
    setSaveState(state);
    $('rsvp-summary').focus({preventScroll:true});
    scrollToElement($('rsvp-summary'));
  }
  window.sendRSVP = async function (event) {
    event.preventDefault();
    if (busy || !$('rsvp-form').reportValidity()) return;
    const result = core.validate({name:$('guest-name').value,phone:$('guest-phone').value,attendance:$('attendance').value,adults:$('adults').value,children:$('children').value,message:$('message').value,website:$('guest-website').value});
    $('rsvp-error').hidden = true;
    if (result.error) {
      $('rsvp-error').textContent = result.error; $('rsvp-error').hidden = false;
      $(result.field).focus(); return;
    }
    busy = true;
    $('rsvp-submit').disabled = true;
    $('rsvp-edit').disabled = true;
    const data = result.data;
    let key = null, attempt;
    try {
      key = await fingerprint(data);
      const memoryKey = key || JSON.stringify(data);
      attempt = attempts.get(memoryKey);
      if (!attempt && key) {
        try {
          const cached = JSON.parse(storage.get('wedding-rsvp-' + key));
          if (cached && Date.now() - cached.at < 24 * 60 * 60 * 1000) attempt = cached;
        } catch (_) { /* An invalid cache never means the response was saved. */ }
      }
      if (attempt) { showSummary(data, attempt.state === 'saved' ? 'saved' : 'unknown'); return; }
      attempt = {id:requestId(), at:Date.now(), state:'unknown'};
      attempts.set(memoryKey, attempt);
      // Cache only a digest and receipt state, never names, phones or dedications.
      if (key) storage.set('wedding-rsvp-' + key, JSON.stringify(attempt));
      showSummary(data, 'pending');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(window.RSVP_ENDPOINT, {
          method:'POST', mode:'cors', credentials:'omit', redirect:'follow',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body:JSON.stringify({...data, requestId:attempt.id, website:''}), signal:controller.signal
        });
        const receipt = await response.json();
        attempt.state = core.verifiedReceipt(response, receipt, attempt.id) ? 'saved' : receipt?.ok === false ? 'rejected' : 'unknown';
      } catch (_) { attempt.state = 'unknown'; }
      finally { clearTimeout(timeout); }
      if (key) storage.set('wedding-rsvp-' + key, JSON.stringify(attempt));
      setSaveState(attempt.state);
    } catch (_) {
      showSummary(data, 'unknown');
    } finally {
      busy = false;
      $('rsvp-submit').disabled = false;
      $('rsvp-edit').disabled = false;
    }
  };
  $('rsvp-edit').addEventListener('click', () => {
    if (busy) return;
    $('rsvp-summary').hidden = true;
    $('rsvp-form').hidden = false;
    $('guest-name').focus();
    scrollToElement($('rsvp-form'));
  });
})();

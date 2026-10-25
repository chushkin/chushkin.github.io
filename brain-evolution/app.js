(() => {
  'use strict';

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];
  const deviceButtons = [...document.querySelectorAll('[data-device]')];
  const status = document.getElementById('preview-status');
  let device = 'iphone';

  function activateTab(next, focus = false) {
    tabs.forEach((tab, index) => {
      const active = index === next;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[index].hidden = !active;
    });
    if (focus) tabs[next].focus();
    if (status) status.textContent = `${tabs[next].textContent.trim()} · ${device === 'ipad' ? 'iPad' : 'iPhone'} · 1.2.0`;
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      activateTab(next, true);
    });
  });
  if (tabs.length && panels.length === tabs.length) activateTab(0);

  deviceButtons.forEach(button => {
    button.addEventListener('click', () => {
      device = button.dataset.device;
      deviceButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      panels.forEach(panel => {
        const image = panel.querySelector('.screen-expand img');
        if (!image) return;
        image.src = image.dataset[device];
        image.width = device === 'ipad' ? 900 : 700;
        image.height = device === 'ipad' ? 1201 : 1517;
        image.alt = `${image.dataset.alt} · ${device === 'ipad' ? 'iPad' : 'iPhone'} · 1.2.0`;
      });
      const current = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
      if (current >= 0) activateTab(current);
    });
  });

  const dialog = document.querySelector('.image-dialog');
  const dialogImage = dialog?.querySelector('.dialog-body img');
  const closeButton = dialog?.querySelector('.dialog-close');
  let lastTrigger = null;
  if (dialog && dialogImage && typeof dialog.showModal === 'function') {
    document.querySelectorAll('.screen-expand').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const image = trigger.querySelector('img');
        if (!image) return;
        lastTrigger = trigger;
        dialogImage.src = image.currentSrc || image.src;
        dialogImage.alt = image.alt;
        dialogImage.width = image.width;
        dialogImage.height = image.height;
        dialog.showModal();
        document.body.classList.add('dialog-open');
        closeButton?.focus();
      });
    });
    closeButton?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      lastTrigger?.focus();
    });
  }
})();

(function () {
  'use strict';

  function closeNotification(modal) {
    if (!modal) return;
    modal.remove();
    document.body.classList.remove('vx_notification_open');
  }

  window.vxNotify = function (message, options) {
    var settings = options || {};
    var existing = document.getElementById('vx_notification_modal');
    if (existing) closeNotification(existing);

    var modal = document.createElement('div');
    modal.id = 'vx_notification_modal';
    modal.className = 'vx_notification_modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'vx_notification_title');
    modal.innerHTML = '<div class="vx_notification_dialog" role="document">' +
      '<div class="vx_notification_icon" aria-hidden="true">!</div>' +
      '<h2 id="vx_notification_title">' + (settings.title || 'Notification') + '</h2>' +
      '<p class="vx_notification_message"></p>' +
      '<button type="button" class="vx_notification_close">Okay</button>' +
      '</div>';

    var style = document.getElementById('vx_notification_styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'vx_notification_styles';
      style.textContent = '.vx_notification_modal{position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,6,23,.72);backdrop-filter:blur(5px)}.vx_notification_dialog{width:min(100%,420px);padding:28px;border:1px solid rgba(148,163,184,.25);border-radius:14px;background:linear-gradient(145deg,#172235,#0f172a);color:#e2e8f0;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.5)}.vx_notification_icon{width:42px;height:42px;margin:0 auto 14px;border-radius:50%;background:#2563eb;color:#fff;font-size:25px;font-weight:700;line-height:42px}.vx_notification_dialog h2{margin:0 0 10px;color:#f8fafc;font-size:21px}.vx_notification_message{margin:0 0 22px;color:#cbd5e1;line-height:1.6;white-space:pre-wrap}.vx_notification_close{border:0;border-radius:7px;background:#2563eb;color:#fff;cursor:pointer;font:inherit;font-weight:700;padding:11px 24px}.vx_notification_close:focus-visible{outline:3px solid rgba(125,211,252,.8);outline-offset:2px}';
      document.head.appendChild(style);
    }

    modal.querySelector('.vx_notification_message').textContent = String(message || '');
    document.body.appendChild(modal);
    document.body.classList.add('vx_notification_open');

    var closeButton = modal.querySelector('.vx_notification_close');
    closeButton.addEventListener('click', function () { closeNotification(modal); });
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeNotification(modal);
    });
    var handleEscape = function (event) {
      if (event.key === 'Escape') {
        closeNotification(modal);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    closeButton.focus();
  };
}());

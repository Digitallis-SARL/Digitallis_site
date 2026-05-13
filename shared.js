/* ════════════════════════════════════════════════════════════
   DIGITALLIS — Shared interactions (nav, cursor, magnetic, faq, fade-up)
   ════════════════════════════════════════════════════════════ */
(function() {
  gsap.registerPlugin(ScrollTrigger);

  // ─── Navbar scroll state ───
  var nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', function() {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  // ─── Cursor glow ───
  var glow = document.getElementById('glow');
  if (glow) {
    var mx = 0, my = 0, gx = 0, gy = 0;
    document.addEventListener('mousemove', function(e) { mx = e.clientX; my = e.clientY; });
    (function moveGlow() {
      gx += (mx - gx) * 0.12;
      gy += (my - gy) * 0.12;
      glow.style.transform = 'translate(' + (gx - 300) + 'px,' + (gy - 300) + 'px)';
      requestAnimationFrame(moveGlow);
    })();
  }

  // ─── Magnetic buttons ───
  document.querySelectorAll('.magnetic').forEach(function(btn) {
    btn.addEventListener('mousemove', function(e) {
      var rect = btn.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      btn.style.transform = 'translate(' + ((e.clientX - cx) * 0.22) + 'px,' + ((e.clientY - cy) * 0.22) + 'px)';
    });
    btn.addEventListener('mouseleave', function() {
      btn.style.transform = 'translate(0,0)';
    });
  });

  // ─── Spotlight cards (on any grid with .spot-grid or [data-spotlight]) ───
  document.querySelectorAll('.spot-grid, [data-spotlight]').forEach(function(gridEl) {
    gridEl.addEventListener('mousemove', function(e) {
      gridEl.querySelectorAll('.spot-card, .testimonial, .pain-card, .why-card, .value-card').forEach(function(c) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  });

  // ─── Odometer counters ───
  document.querySelectorAll('.odometer').forEach(function(odo) {
    var val = odo.dataset.value;
    var suffix = odo.dataset.suffix || '';
    var prefix = odo.dataset.prefix || '';
    var divide = odo.dataset.divide;
    var display = val;

    if (divide === '10') {
      var n = parseInt(val) / 10;
      display = n.toFixed(1);
    }

    var chars = display.split('');
    odo.innerHTML = '';

    if (prefix) {
      var p = document.createElement('span'); p.className = 'stat-prefix'; p.textContent = prefix;
      odo.appendChild(p);
    }

    chars.forEach(function(c) {
      if (/\d/.test(c)) {
        var digit = document.createElement('div'); digit.className = 'odo-digit';
        var strip = document.createElement('div'); strip.className = 'odo-strip';
        for (var i = 0; i <= 9; i++) {
          var s = document.createElement('span'); s.textContent = i; strip.appendChild(s);
        }
        digit.appendChild(strip);
        odo.appendChild(digit);
      } else {
        var sep = document.createElement('span');
        sep.textContent = c;
        sep.style.display = 'inline-block';
        sep.style.lineHeight = '1';
        odo.appendChild(sep);
      }
    });

    if (suffix) {
      var s = document.createElement('span'); s.className = 'stat-suffix'; s.textContent = suffix;
      odo.appendChild(s);
    }

    ScrollTrigger.create({
      trigger: odo, start: 'top 85%', once: true,
      onEnter: function() {
        var strips = odo.querySelectorAll('.odo-strip');
        var digitIdx = 0;
        chars.forEach(function(c) {
          if (/\d/.test(c)) {
            var target = parseInt(c);
            var strip = strips[digitIdx];
            var h = strip.children[0].offsetHeight;
            strip.style.transform = 'translateY(-' + (target * h) + 'px)';
            strip.style.transitionDelay = (digitIdx * 0.12) + 's';
            digitIdx++;
          }
        });
      }
    });
  });

  // ─── FAQ accordion ───
  document.querySelectorAll('.faq-item').forEach(function(item) {
    item.addEventListener('click', function() {
      item.classList.toggle('open');
    });
  });

  // ─── Fade-up sections ───
  gsap.utils.toArray('.fade-up').forEach(function(el) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.9, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%' }
    });
  });

  // ─── 3D tilt on .tilt-card ───
  document.querySelectorAll('.tilt-card').forEach(function(card) {
    card.addEventListener('mousemove', function(e) {
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = 'perspective(800px) rotateY(' + (x * 6) + 'deg) rotateX(' + (-y * 6) + 'deg) translateZ(0)';
    });
    card.addEventListener('mouseleave', function() {
      card.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0)';
    });
  });

  // ─── Web3Forms unified form handler ───
  // Destination: contact@digitallis.fr (configured in Web3Forms dashboard)
  var WEB3FORMS_KEY = '0555ec62-8c53-4c06-a957-0c56fbef86ca';
  var WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
  var FALLBACK_EMAIL = 'info@digitallis.fr';

  function collectFormData(form) {
    var data = {};
    var inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(function(input) {
      if (input.type === 'submit' || input.type === 'button') return;
      if (input.name === 'botcheck') return;
      if (input.type === 'checkbox' && !input.checked) return;
      var key = input.name || input.id || input.getAttribute('aria-label') || input.placeholder;
      if (!key) return;
      var value = (input.value || '').trim();
      if (value) data[key] = value;
    });
    return data;
  }

  function buildSubject(source, data) {
    var labels = {
      'audit-homepage': 'Demande d\'audit (Homepage)',
      'audit-page': 'Demande d\'audit complète',
      'contact': 'Nouveau message contact',
      'newsletter': 'Nouvelle inscription newsletter'
    };
    var base = labels[source] || 'Nouveau formulaire';
    var company = data['f-company'] || data['company'] || data['Nom de votre entreprise'] || data['Nom de l\'entreprise *'] || '';
    var name = data['f-name'] || data['Nom complet *'] || data['Votre prénom'] || '';
    var who = company || name;
    return '[Digitallis] ' + base + (who ? ' — ' + who : '');
  }

  function buildFallbackMailto(source, data) {
    var subject = encodeURIComponent(buildSubject(source, data));
    var bodyLines = ['Formulaire : ' + (source || 'inconnu'), 'Page : ' + window.location.href, ''];
    Object.keys(data).forEach(function(k) {
      if (k === 'botcheck') return;
      bodyLines.push(k + ' : ' + data[k]);
    });
    var body = encodeURIComponent(bodyLines.join('\n'));
    return 'mailto:' + FALLBACK_EMAIL + '?subject=' + subject + '&body=' + body;
  }

  function showSuccess(btn, oldHTML) {
    btn.innerHTML = '✓ Reçu — on vous recontacte';
    btn.style.background = '#28C941';
    btn.style.color = '#fff';
    btn.disabled = false;
    setTimeout(function() {
      btn.innerHTML = oldHTML;
      btn.style.background = '';
      btn.style.color = '';
    }, 4000);
  }

  function showError(btn, oldHTML, mailtoUrl) {
    btn.innerHTML = '⚠ Erreur — cliquez pour envoyer par email';
    btn.style.background = '#FFB020';
    btn.style.color = '#000';
    btn.disabled = false;
    btn.onclick = function() { window.location.href = mailtoUrl; };
    setTimeout(function() {
      btn.innerHTML = oldHTML;
      btn.style.background = '';
      btn.style.color = '';
      btn.onclick = null;
    }, 8000);
  }

  window.digitallisForm = function(e, source) {
    e.preventDefault();
    var form = e.target.closest('form') || e.target;
    var btn = form.querySelector('button[type="submit"]') || form.querySelector('button:last-of-type');
    if (!btn) return false;

    // Honeypot check (bots fill hidden field). For checkboxes, only treat as filled when actually checked.
    var honeypot = form.querySelector('input[name="botcheck"]');
    if (honeypot) {
      var isCheckbox = honeypot.type === 'checkbox';
      var filled = isCheckbox ? honeypot.checked : !!honeypot.value;
      if (filled) return false;
    }

    var data = collectFormData(form);
    var subject = buildSubject(source, data);
    var oldHTML = btn.innerHTML;

    btn.innerHTML = 'Envoi en cours…';
    btn.disabled = true;

    var payload = {
      access_key: WEB3FORMS_KEY,
      subject: subject,
      from_name: 'Digitallis - Site web',
      replyto: data['f-email'] || data['Email *'] || data['Email professionnel'] || data['votre@email.com'] || '',
      _source: source || 'unknown',
      _page: window.location.pathname
    };
    Object.keys(data).forEach(function(k) {
      if (!payload[k]) payload[k] = data[k];
    });

    fetch(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res && res.success) {
          form.reset();
          showSuccess(btn, oldHTML);
        } else {
          showError(btn, oldHTML, buildFallbackMailto(source, data));
        }
      })
      .catch(function() {
        showError(btn, oldHTML, buildFallbackMailto(source, data));
      });

    return false;
  };

  // Backward compat: keep handleAudit working (homepage form uses it)
  window.handleAudit = function(e) {
    return window.digitallisForm(e, 'audit-homepage');
  };
})();

/* Shared styles for odometer digits (injected so any page using shared.js gets them) */
(function() {
  var css = '\
    .odometer { font-family: "Outfit", sans-serif; font-weight: 700; font-feature-settings: "tnum"; letter-spacing: -0.04em; color: var(--accent); display: flex; align-items: baseline; line-height: 1; overflow: hidden; }\
    .odo-digit { display: inline-block; overflow: hidden; height: 1em; position: relative; }\
    .odo-strip { display: flex; flex-direction: column; transition: transform 1.6s cubic-bezier(.16,1,.3,1); }\
    .odo-strip span { display: block; height: 1em; line-height: 1; }\
    .stat-prefix, .stat-suffix { font-family: "Instrument Serif", serif; font-style: italic; font-weight: 400; font-size: 0.45em; color: var(--accent); margin: 0 0.05em; align-self: flex-start; padding-top: 0.1em; }\
  ';
  var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();

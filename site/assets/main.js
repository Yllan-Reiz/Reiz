/* Reiz : site officiel. Aucune dépendance. */

/* ============================================================
   RÉGLAGES À CHANGER LE JOUR DE LA SORTIE
   appStoreUrl : lien de la fiche App Store. Tant qu'il est vide, le site
   propose la liste de sortie (e-mail). Dès qu'il est rempli, tous les
   boutons deviennent « Télécharger » et les formulaires disparaissent.
   Lien prévu : https://apps.apple.com/fr/app/id6814173335
   ============================================================ */
const CONFIG = {
  appStoreUrl: '',
  supabaseUrl: 'https://vpaizbtetwsnvbpmeuab.supabase.co',
  // Clé publique « publishable » : faite pour être dans une page web.
  // La table waitlist n'accepte que des insertions (RLS), personne ne peut la lire depuis le site.
  supabaseKey: 'sb_publishable_dAHRrHfSQvNwm1LEpNw5Ww_EOTyejXT',
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Mesure de conversion respectueuse ----------
   Aucun traceur installé. Chaque action importante émet un événement « reiz:track ».
   Pour brancher un outil sans cookie (Plausible, Umami...), ajouter son script dans
   index.html : les événements lui sont transmis automatiquement s'il expose window.plausible
   ou window.umami. */
function track(name, props) {
  const detail = { name, props: props || {} };
  try { window.dispatchEvent(new CustomEvent('reiz:track', { detail })); } catch (_) {}
  try { if (typeof window.plausible === 'function') window.plausible(name, { props: detail.props }); } catch (_) {}
  try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, detail.props); } catch (_) {}
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-track]');
  if (el) track(el.dataset.track);
});

/* ---------- État « sortie » ---------- */
if (CONFIG.appStoreUrl) {
  document.documentElement.classList.add('is-live');
  document.querySelectorAll('[data-store-link]').forEach((a) => {
    a.href = CONFIG.appStoreUrl;
    a.target = '_blank';
    a.rel = 'noopener';
  });
}

/* ---------- Menu mobile ---------- */
(() => {
  const btn = document.querySelector('.nav-menu-btn');
  const sheet = document.getElementById('menu-mobile');
  if (!btn || !sheet) return;
  const icon = btn.querySelector('use');
  const setOpen = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    icon.setAttribute('href', open ? '#i-close' : '#i-menu');
    sheet.hidden = !open;
  };
  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { setOpen(false); btn.focus(); }
  });
  window.matchMedia('(min-width: 881px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
})();

/* ---------- Liste de sortie (table Supabase « waitlist ») ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DONE_KEY = 'reiz.waitlist.done';

function markAllDone() {
  document.querySelectorAll('[data-waitlist]').forEach((f) => f.classList.add('is-done'));
}
try { if (localStorage.getItem(DONE_KEY)) markAllDone(); } catch (_) {}

document.querySelectorAll('[data-waitlist]').forEach((form) => {
  const input = form.querySelector('input[type="email"]');
  const honey = form.querySelector('.hp');
  const btn = form.querySelector('button[type="submit"]');
  const label = btn.querySelector('.btn-label');
  const msg = form.querySelector('.waitlist-msg');
  const defaultMsg = msg.innerHTML;
  const where = form.dataset.waitlist;

  const showError = (text) => {
    msg.textContent = text;
    msg.classList.add('is-error');
    input.setAttribute('aria-invalid', 'true');
  };
  const clearError = () => {
    if (!msg.classList.contains('is-error')) return;
    msg.innerHTML = defaultMsg;
    msg.classList.remove('is-error');
    input.removeAttribute('aria-invalid');
  };
  input.addEventListener('input', clearError);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (btn.disabled) return;
    const email = input.value.trim().toLowerCase();
    if (honey && honey.value) return; // robot
    if (!email) { showError('Écris ton adresse e-mail pour être prévenu.'); input.focus(); return; }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      showError('Cette adresse ne semble pas valide. Vérifie-la, par exemple prenom@gmail.com.');
      input.focus();
      return;
    }

    btn.disabled = true;
    const original = label.textContent;
    label.innerHTML = '<span class="spinner" aria-hidden="true"></span><span class="sr-only">Envoi en cours</span>';

    let result = 'error';
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.supabaseKey,
          Authorization: `Bearer ${CONFIG.supabaseKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) result = 'ok';
      else if (res.status === 409) result = 'already';
      else if (res.status === 400) result = 'invalid';
    } catch (_) {
      result = 'network';
    }

    btn.disabled = false;
    label.textContent = original;

    if (result === 'ok' || result === 'already') {
      try { localStorage.setItem(DONE_KEY, '1'); } catch (_) {}
      if (result === 'already') {
        document.querySelectorAll('.waitlist-done strong').forEach((s) => { s.textContent = 'Tu es déjà sur la liste.'; });
      }
      markAllDone();
      track('waitlist_signup', { where, already: result === 'already' });
      return;
    }
    if (result === 'invalid') showError('Cette adresse ne semble pas valide. Vérifie-la et réessaie.');
    else if (result === 'network') showError("Pas de connexion pour l'instant. Vérifie ton réseau puis réessaie.");
    else showError("L'inscription n'est pas passée de notre côté. Réessaie dans un instant.");
    track('waitlist_error', { where, result });
  });
});

/* ---------- Fonctionnalités : téléphone collant ---------- */
(() => {
  const target = document.querySelector('[data-feat-screen]');
  const steps = Array.from(document.querySelectorAll('.feat-step'));
  if (!target || !steps.length) return;

  // Une seule source d'écrans : on copie celui de chaque étape dans le téléphone collant.
  const screens = steps.map((step, i) => {
    const scr = step.querySelector('.scr').cloneNode(true);
    scr.querySelectorAll('img[loading="lazy"]').forEach((img) => img.removeAttribute('loading'));
    if (i === 0) scr.classList.add('is-on');
    target.appendChild(scr);
    return scr;
  });

  // Pastille de verre qui déborde du téléphone : celle de l'étape active
  const chip = document.querySelector('[data-edge-chip]');
  const chipFor = (i) => steps[i].querySelector('.edge-chip');
  const setChip = (i) => {
    if (!chip || !chipFor(i)) return;
    chip.innerHTML = chipFor(i).innerHTML;
    chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
  };
  setChip(0);

  let current = 0;
  const activate = (i) => {
    if (i === current) return;
    current = i;
    steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
    screens.forEach((s, k) => s.classList.toggle('is-on', k === i));
    setChip(i);
  };

  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) activate(steps.indexOf(en.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((s) => io.observe(s));
})();

/* ---------- Badges : sélection, inclinaison 3D, reflet ---------- */
(() => {
  const buttons = Array.from(document.querySelectorAll('.badge-btn'));
  const detail = document.querySelector('[data-badge-detail]');
  const section = document.querySelector('.badges');
  if (!buttons.length || !detail) return;
  const dName = detail.querySelector('[data-detail-name]');
  const dRule = detail.querySelector('[data-detail-rule]');
  const dImg = detail.querySelector('[data-detail-img]');
  const dSrc = detail.querySelector('[data-detail-source]');

  const select = (btn) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const id = btn.dataset.badge;
    dName.textContent = btn.dataset.name;
    dRule.textContent = btn.dataset.rule;
    dSrc.srcset = `assets/badges/${id}.avif`;
    dImg.src = `assets/badges/${id}.png`;
    detail.style.setProperty('--accent', btn.dataset.color);
    section.style.setProperty('--accent', btn.dataset.color);
    if (!reduceMotion && detail.animate) {
      detail.querySelector('.big').animate(
        [{ transform: 'scale(0.92) rotate(-4deg)', opacity: 0.4 }, { transform: 'none', opacity: 1 }],
        { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    }
    track('badge_view', { badge: id });
  };
  buttons.forEach((btn) => btn.addEventListener('click', () => select(btn)));
  section.style.setProperty('--accent', buttons[0].dataset.color);
  detail.style.setProperty('--accent', buttons[0].dataset.color);

  // Flèches du clavier pour passer d'un badge à l'autre
  buttons.forEach((btn, i) => btn.addEventListener('keydown', (e) => {
    const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = buttons[(i + map[e.key] + buttons.length) % buttons.length];
    next.focus();
  }));

  if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  buttons.forEach((btn) => {
    const b = btn.querySelector('.badge-3d');
    let raf = 0;
    btn.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        b.classList.add('is-tilting');
        b.style.setProperty('--ry', `${(x - 0.5) * 26}deg`);
        b.style.setProperty('--rx', `${(0.5 - y) * 26}deg`);
        b.style.setProperty('--mx', `${x * 100}%`);
        b.style.setProperty('--my', `${y * 100}%`);
      });
    });
    btn.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      b.classList.remove('is-tilting');
      b.style.setProperty('--rx', '0deg');
      b.style.setProperty('--ry', '0deg');
    });
  });
})();

/* ---------- Galerie : boutons précédent / suivant ---------- */
(() => {
  const g = document.querySelector('[data-gallery]');
  if (!g) return;
  const step = () => {
    const shot = g.querySelector('.shot');
    return shot ? shot.getBoundingClientRect().width + 30 : 300;
  };
  const go = (dir) => g.scrollBy({ left: dir * step(), behavior: reduceMotion ? 'auto' : 'smooth' });
  document.querySelector('[data-gallery-prev]')?.addEventListener('click', () => go(-1));
  document.querySelector('[data-gallery-next]')?.addEventListener('click', () => go(1));
})();

/* ---------- FAQ : suivi des ouvertures (le contenu reste du HTML natif) ---------- */
document.querySelectorAll('.faq-item').forEach((d) => {
  d.addEventListener('toggle', () => {
    if (!d.open) return;
    // Navigateurs sans <details name> : on referme les autres à la main
    document.querySelectorAll('.faq-item[open]').forEach((o) => { if (o !== d) o.open = false; });
  });
});

/* ---------- Parallaxe légère des badges du hero (souris seulement) ---------- */
(() => {
  if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const stage = document.querySelector('.hero-stage');
  if (!stage) return;
  const items = Array.from(stage.querySelectorAll('.sticker, .hero-phone'));
  let raf = 0;
  window.addEventListener('pointermove', (e) => {
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      items.forEach((el, i) => {
        const depth = el.classList.contains('hero-phone') ? 6 : 14 + i * 4;
        el.style.translate = `${x * depth}px ${y * depth}px`;
      });
    });
  }, { passive: true });
})();

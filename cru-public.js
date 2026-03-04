const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

function setScrollState() {
  document.body.classList.toggle('is-scrolled', window.scrollY > 10);
}

function closeNav() {
  if (!toggle || !nav) {
    return;
  }
  nav.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
}

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((item) => {
    item.addEventListener('click', closeNav);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNav();
    }
  });

  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('is-open')) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest('.site-nav') && !target.closest('.menu-toggle')) {
      closeNav();
    }
  });
}

setScrollState();
window.addEventListener('scroll', setScrollState, { passive: true });

function wireFieldStates(form) {
  const fields = form.querySelectorAll('input, select');
  fields.forEach((field) => {
    const updateFieldState = () => {
      field.classList.remove('is-valid', 'is-invalid');
      if (!field.value.trim()) {
        return;
      }
      field.classList.add(field.checkValidity() ? 'is-valid' : 'is-invalid');
    };
    field.addEventListener('blur', updateFieldState);
    field.addEventListener('input', updateFieldState);
    field.addEventListener('change', updateFieldState);
  });
}

function wireActiveNav() {
  if (!nav) {
    return;
  }
  const links = Array.from(nav.querySelectorAll('a'));
  const currentPath = (window.location.pathname.replace(/\/+$/, '') || '/').toLowerCase();
  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#')) {
      return;
    }
    try {
      const parsed = new URL(href, window.location.origin);
      const linkPath = (parsed.pathname.replace(/\/+$/, '') || '/').toLowerCase();
      if (linkPath === currentPath) {
        link.classList.add('is-active');
      }
    } catch (_) {
      // Ignore malformed href values.
    }
  });

  const hashLinks = links.filter((link) => (link.getAttribute('href') || '').startsWith('#'));
  const sectionMap = hashLinks
    .map((link) => {
      const href = link.getAttribute('href');
      if (!href) {
        return null;
      }
      const section = document.querySelector(href);
      if (!section) {
        return null;
      }
      return { link, section };
    })
    .filter(Boolean);

  if (!sectionMap.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        sectionMap.forEach(({ link }) => link.classList.remove('is-active'));
        const match = sectionMap.find(({ section }) => section === entry.target);
        if (match) {
          match.link.classList.add('is-active');
        }
      });
    },
    { threshold: 0.45, rootMargin: '-20% 0px -35% 0px' }
  );

  sectionMap.forEach(({ section }) => observer.observe(section));
}

function wireForm(formSelector, statusSelector, okMessage) {
  const form = document.querySelector(formSelector);
  const statusEl = document.querySelector(statusSelector);

  if (!form || !statusEl) {
    return;
  }

  wireFieldStates(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');

    if (!form.checkValidity()) {
      statusEl.textContent = 'Please complete all fields before submitting your request.';
      statusEl.style.color = '#a47000';
      form.querySelectorAll('input, select').forEach((field) => {
        if (!field.checkValidity()) {
          field.classList.add('is-invalid');
        }
      });
      return;
    }

    statusEl.textContent = 'Submitting your request...';
    statusEl.style.color = '#166b4e';
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
    }

    try {
      const fields = Object.fromEntries(new FormData(form).entries());
      const type = formSelector === '.ad-form' ? 'cru_advertising' : 'cru_early_access';
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          fields,
          sourcePage: 'cru',
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      statusEl.textContent = okMessage;
      statusEl.style.color = '#166b4e';
      form.reset();
      form.querySelectorAll('.is-valid, .is-invalid').forEach((field) => {
        field.classList.remove('is-valid', 'is-invalid');
      });
    } catch (error) {
      statusEl.textContent = 'Submission failed. Please verify email configuration and try again.';
      statusEl.style.color = '#a47000';
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.label || 'Submit';
      }
    }
  });
}

document.querySelectorAll('button[type="submit"]').forEach((button) => {
  if (!button.dataset.label) {
    button.dataset.label = button.textContent || 'Submit';
  }
});

wireForm('.access-form', '.form-status', 'You are on the Cru early access list. We will contact you soon.');
wireForm('.ad-form', '.ad-form-status', 'Your advertising interest has been recorded. The Cru partnerships team will contact you.');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('.reveal').forEach((block) => observer.observe(block));
wireActiveNav();

const year = document.getElementById('year');
if (year) {
  year.textContent = String(new Date().getFullYear());
}

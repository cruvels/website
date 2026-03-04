const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

function setScrollState() {
  document.body.classList.toggle('is-scrolled', window.scrollY > 10);
}

function closeNav() {
  if (!menuToggle || !nav) {
    return;
  }
  nav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((anchor) => {
    anchor.addEventListener('click', closeNav);
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
  const fields = form.querySelectorAll('input, textarea, select');
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
  const hashLinks = links.filter((link) => {
    const href = link.getAttribute('href') || '';
    return href.startsWith('#');
  });
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

function wireLeadForm({ formSelector, statusSelector, type, sourcePage, successMessage }) {
  const form = document.querySelector(formSelector);
  const statusText = document.querySelector(statusSelector);

  if (!form || !statusText) {
    return;
  }

  wireFieldStates(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');

    if (!form.checkValidity()) {
      statusText.textContent = 'Please complete all required fields before submitting.';
      statusText.style.color = '#ffd08a';
      form.querySelectorAll('input, textarea, select').forEach((field) => {
        if (!field.checkValidity()) {
          field.classList.add('is-invalid');
        }
      });
      return;
    }

    statusText.textContent = 'Submitting your request...';
    statusText.style.color = '#9ae8be';
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
    }

    try {
      const fields = Object.fromEntries(new FormData(form).entries());
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, fields, sourcePage }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      statusText.textContent = successMessage;
      statusText.style.color = '#9ae8be';
      form.reset();
      form.querySelectorAll('.is-valid, .is-invalid').forEach((field) => {
        field.classList.remove('is-valid', 'is-invalid');
      });
    } catch (error) {
      statusText.textContent = 'Submission failed. Please verify email configuration and try again.';
      statusText.style.color = '#ffd08a';
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

wireLeadForm({
  formSelector: '.contact-form',
  statusSelector: '.form-status',
  type: 'cruvel_inquiry',
  sourcePage: 'cruvel',
  successMessage: 'Thank you. Your request has been received by the Cruvel team.',
});

wireLeadForm({
  formSelector: '.careers-form',
  statusSelector: '.careers-form-status',
  type: 'cruvel_careers',
  sourcePage: 'cruvel_careers',
  successMessage: 'Thank you. Your application interest has been received by the Cruvel hiring team.',
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

wireActiveNav();

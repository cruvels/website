const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((item) => {
    item.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function wireForm(formSelector, statusSelector, okMessage) {
  const form = document.querySelector(formSelector);
  const statusEl = document.querySelector(statusSelector);

  if (!form || !statusEl) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      statusEl.textContent = 'Please complete all fields before submitting your request.';
      statusEl.style.color = '#a47000';
      return;
    }

    statusEl.textContent = 'Submitting your request...';
    statusEl.style.color = '#166b4e';

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
    } catch (error) {
      statusEl.textContent = 'Submission failed. Please try again when the server is running.';
      statusEl.style.color = '#a47000';
    }
  });
}

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

const year = document.getElementById('year');
if (year) {
  year.textContent = String(new Date().getFullYear());
}

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((anchor) => {
    anchor.addEventListener('click', () => {
      nav.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function wireLeadForm({ formSelector, statusSelector, type, sourcePage, successMessage }) {
  const form = document.querySelector(formSelector);
  const statusText = document.querySelector(statusSelector);

  if (!form || !statusText) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      statusText.textContent = 'Please complete all required fields before submitting.';
      statusText.style.color = '#ffd08a';
      return;
    }

    statusText.textContent = 'Submitting your request...';
    statusText.style.color = '#9ae8be';

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
    } catch (error) {
      statusText.textContent = 'Submission failed. Please verify email configuration and try again.';
      statusText.style.color = '#ffd08a';
    }
  });
}

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

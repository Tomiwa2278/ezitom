/**
 * backend-api.js — Modern AJAX handler for EziTom Portfolio
 * REFACTORED: Now uses DataManager (localStorage) instead of hardcoded local data.
 */

console.log('[dev.folio DEBUG] backend-api.js loaded (Persistent Mode).');

// ── Utility: safe HTML escape ──────────────────────────────
function escHtml(str) {
  if (typeof str !== 'string') return str;
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Utility: show toast ────────────────────────────────────
function showToast(msg, isError = false) {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast) { alert(msg); return; }
  toastMsg.textContent = msg;
  toast.classList.toggle('error-toast', isError);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 5000);
}

// ── Utility: Sync to Google Sheets (Option A) ──────────────
async function syncToGoogleSheets(formData) {
    const scriptUrl = window.CONFIG?.GOOGLE_SCRIPT_URL;
    if (!scriptUrl) return;

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors', // Apps Script requires no-cors for simple triggers
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(formData)
        });
        console.log('[dev.folio DEBUG] Synced to Google Sheets.');
    } catch (e) {
        console.error('[dev.folio DEBUG] Google Sheets Sync Error:', e);
    }
}

// ── CONTACT FORM — EmailJS Integration ─────────────────────
const contactFormPHP = document.getElementById('contact-form');

if (contactFormPHP) {
  contactFormPHP.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    let isValid = true;
    contactFormPHP.querySelectorAll('input, select, textarea').forEach(input => {
      input.classList.remove('error');
      if (input.hasAttribute('required') && !input.value.trim()) {
        input.classList.add('error');
        isValid = false;
      }
    });
    if (!isValid) return;

    const submitBtn = document.getElementById('submitBtn');
    const btnText   = document.getElementById('btnText');
    const spinner   = document.getElementById('btnSpinner');
    const btnIcon   = document.getElementById('btnIcon');

    submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnIcon) btnIcon.style.display = 'none';
    if (spinner) spinner.style.display = 'block';

    const formData = {
        name: [
          document.getElementById('firstName')?.value.trim(),
          document.getElementById('lastName')?.value.trim()
        ].filter(Boolean).join(' '),
        email: document.getElementById('email')?.value.trim() || '',
        subject: document.getElementById('subject')?.value.trim() || '',
        message: document.getElementById('message')?.value.trim() || ''
    };

    console.log('[dev.folio DEBUG] Attempting EmailJS send:', formData);

    try {
        // Initialize EmailJS if not already done (using key from main.js or import.meta.env)
        const publicKey = window.CONFIG?.EMAILJS_PUBLIC_KEY;
        const serviceId = window.CONFIG?.EMAILJS_SERVICE_ID;
        const templateId = window.CONFIG?.EMAILJS_TEMPLATE_ID;

        emailjs.init(publicKey);

        const templateParams = {
            from_name: formData.name,
            from_email: formData.email,
            subject: formData.subject,
            message: formData.message,
            date_time: new Date().toLocaleString()
        };

        const response = await emailjs.send(serviceId, templateId, templateParams);
        console.log('[dev.folio DEBUG] EmailJS Success:', response);

        // Option A: Sync to Google Sheets
        await syncToGoogleSheets({ ...formData, timestamp: new Date().toISOString() });

        // Save to localStorage with 'sent' status
        if (window.DataManager) {
            window.DataManager.saveMessage({ ...formData, emailStatus: 'sent' });
        }

        showToast("Thanks for reaching out! Your message has been received successfully.", false);
        contactFormPHP.reset();
    } catch (error) {
        console.error('[dev.folio DEBUG] EmailJS Error:', error);

        // Save to localStorage with 'failed' status
        if (window.DataManager) {
            window.DataManager.saveMessage({ ...formData, emailStatus: 'failed' });
        }

        showToast("Sorry, there was an issue sending your message. Please try again or email me directly.", true);
        // Do NOT reset form on failure
    } finally {
        submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'block';
        if (btnIcon) btnIcon.style.display = 'block';
        if (spinner) spinner.style.display = 'none';

        if (typeof gtag !== 'undefined') {
          gtag('event', 'form_submit', { event_category: 'contact', event_label: 'contact_page_form' });
        }
    }
  }, true);
}

// ── HOME ENQUIRY FORM — EmailJS Integration ───────────────
const homeEnquiryFormPHP = document.getElementById('homeEnquiryForm');

if (homeEnquiryFormPHP) {
  homeEnquiryFormPHP.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    let isValid = true;
    homeEnquiryFormPHP.querySelectorAll('input, select, textarea').forEach(input => {
      input.classList.remove('error');
      if (input.hasAttribute('required') && !input.value.trim()) {
        input.classList.add('error');
        isValid = false;
      }
    });
    if (!isValid) return;

    const submitBtn = document.getElementById('enqSubmitBtn');
    const btnText   = document.getElementById('enqBtnText');
    const spinner   = document.getElementById('enqSpinner');

    submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (spinner) spinner.style.display = 'block';

    const formData = {
        name: document.getElementById('enqName')?.value.trim() || '',
        email: document.getElementById('enqEmail')?.value.trim() || '',
        subject: document.getElementById('enqService')?.value.trim() || '',
        message: document.getElementById('enqMessage')?.value.trim() || ''
    };

    console.log('[dev.folio DEBUG] Attempting Home Enquiry EmailJS send:', formData);

    try {
        const publicKey = window.CONFIG?.EMAILJS_PUBLIC_KEY;
        const serviceId = window.CONFIG?.EMAILJS_SERVICE_ID;
        const templateId = window.CONFIG?.EMAILJS_TEMPLATE_ID;

        emailjs.init(publicKey);

        const templateParams = {
            from_name: formData.name,
            from_email: formData.email,
            subject: formData.subject,
            message: formData.message,
            date_time: new Date().toLocaleString()
        };

        const response = await emailjs.send(serviceId, templateId, templateParams);
        console.log('[dev.folio DEBUG] EmailJS Success (Home):', response);

        // Option A: Sync to Google Sheets
        await syncToGoogleSheets({ ...formData, timestamp: new Date().toISOString() });

        if (window.DataManager) {
            window.DataManager.saveMessage({ ...formData, emailStatus: 'sent' });
        }

        showToast("Enquiry received! Your message has been saved successfully.", false);
        homeEnquiryFormPHP.reset();
    } catch (error) {
        console.error('[dev.folio DEBUG] EmailJS Error (Home):', error);

        if (window.DataManager) {
            window.DataManager.saveMessage({ ...formData, emailStatus: 'failed' });
        }

        showToast("Failed to send enquiry. Please try again or use the contact page.", true);
    } finally {
        submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'block';
        if (spinner) spinner.style.display = 'none';

        if (typeof gtag !== 'undefined') {
          gtag('event', 'form_submit', { event_category: 'contact', event_label: 'home_enquiry_form' });
        }
    }
  }, true);
}

// ── DYNAMIC LOADERS ───────────────────────────────────────

/**
 * Renders projects from DataManager
 */
function loadProjects() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    const data = window.DataManager ? window.DataManager.getPortfolioData() : { projects: [] };
    const projects = data.projects;

    if (!projects || projects.length === 0) {
        grid.innerHTML = '<p class="text-muted">No projects found.</p>';
        return;
    }

    grid.innerHTML = projects.map(p => `
        <div class="project-card reveal" data-cat="${escHtml(p.category)}">
            <div class="project-thumb">
                <img src="${escHtml(p.image_url)}" alt="${escHtml(p.title)}" class="project-thumb-img">
                <span class="project-cat-pill">${escHtml(p.category)}</span>
            </div>
            <div class="project-content">
                <div class="project-tags">
                    ${(p.tech_stack || []).map(t => `<span>${escHtml(t)}</span>`).join('')}
                </div>
                <h3>${escHtml(p.title)}</h3>
                <p class="project-copy">${escHtml(p.description)}</p>
                <div class="project-links">
                    <a href="${escHtml(p.live_url)}" target="_blank" class="btn btn-filled project-link live">Live Site &rarr;</a>
                </div>
            </div>
        </div>
    `).join('');
    
    // Re-trigger reveal animation for new items
    if (window.observer) {
        grid.querySelectorAll('.reveal').forEach(el => window.observer.observe(el));
    }
}

/**
 * Renders skills from DataManager
 */
function loadSkills() {
    const container = document.getElementById('skills-container');
    if (!container) return;

    const data = window.DataManager ? window.DataManager.getPortfolioData() : { skills: {} };
    const skillsData = data.skills;
    
    if (!skillsData || Object.keys(skillsData).length === 0) {
        container.innerHTML = '<p class="text-muted">No skills found.</p>';
        return;
    }

    let html = '<div class="skills-grid">';
    
    for (const [category, skills] of Object.entries(skillsData)) {
        html += `
            <div class="skill-card reveal">
                <h3 class="mono">${escHtml(category)}</h3>
                <div class="skill-list">
                    ${skills.map(s => `
                        <div class="skill-bar-row">
                            <div class="skill-bar-info">
                                <span>${escHtml(s.skill_name)}</span>
                                <span>${s.proficiency}%</span>
                            </div>
                            <div class="skill-bar-bg">
                                <div class="skill-bar-fill" data-width="${s.proficiency}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;

    // Re-trigger reveal and skill bar animations
    if (window.observer) {
        container.querySelectorAll('.reveal').forEach(el => window.observer.observe(el));
    }
    if (window.skillObserver) {
        container.querySelectorAll('.skill-bar-fill').forEach(el => window.skillObserver.observe(el));
    }
}

// ── INITIALIZATION ────────────────────────────────────────

function init() {
    console.log('[dev.folio DEBUG] Initializing data loaders...');
    loadProjects();
    loadSkills();
}

// Listen for updates from the dashboard
window.addEventListener('portfolioDataUpdated', () => {
    console.log('[dev.folio DEBUG] Data updated, re-rendering...');
    loadProjects();
    loadSkills();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

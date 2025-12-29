//#region INITIALIZE
let pendingContent = null;
let authRetried = false;
let profile;

// const version = getAPIMode();
const form = document.getElementById('profileForm');

const apiCheckbox = document.getElementById("apiSelector");
if (apiCheckbox) {
    apiCheckbox.addEventListener('change', setAPIMode);
}

//#endregion

//#region FUNCTIONS
function setAPIMode() {
    const apiCheckbox = document.getElementById("apiSelector");
    const apiMode = apiCheckbox.checked ? 'development' : 'v0';
    localStorage.setItem("version", apiMode);
    posthog.capture('apimode_changed', {
        changedTo: apiMode
    });
}

async function getProfileDetails() {
    profile = await apiRequest("profile");

    setProfileDetails(profile);
    saveToLocalStorage("profile", profile);
}

function setProfileDetails(profile) {
    const options = {
        timeZone: "America/New_York",
        year: "numeric",
        month: "short",
        day: "numeric"
    };
    populatePreviewEmailDropdown(profile);
    populateNewsletterTemplateDropdown(profile);
    // Editable fields
    document.getElementById('newsletterName').value = profile.newsletterName || "";
    document.getElementById('businessAddress').value = profile.businessAddress || "";
    document.getElementById('domain').value = profile.domain || "";
    document.getElementById('owner').value = profile.owner || "";
    document.getElementById('replyToEmail').value = profile.replyToEmail || "";
    document.getElementById('senderName').value = profile.senderName || "";
    document.getElementById('senderEmail').value = profile.senderEmail || "";

    // Read-only fields
    document.getElementById('ownerEmail').value = profile.ownerEmail || "";
    const joinedDate = profile.createdAt ? new Date(profile.createdAt) : null;
    document.getElementById('createdAt').value = joinedDate.toLocaleString("en-US", options) || "";
    document.getElementById('maxSubscribers').value = profile.maxSubscribers || "";
    document.getElementById('plan').value = profile.plan || "";
}

async function populatePreviewEmailDropdown(profile) {
    const userDropdown = document.getElementById("previewEmailDropdown");
    const subscribers = await apiRequest("subscribers");

    userDropdown.innerHTML = "";
    let foundActive = false;
    let previewEmailValue = null;
    subscribers.forEach(sub => {
        if (sub.condition == "Subscribed") {
            foundActive = true;
            const opt = document.createElement("option");
            opt.value = JSON.stringify({ id: sub.id, email: sub.emailAddress });
            opt.textContent = `${sub.firstName} (${sub.emailAddress})`;
            if (profile.previewEmailId === sub.id) {
                previewEmailValue = opt.value;
            }
            userDropdown.appendChild(opt);
        }
    });
    userDropdown.value = previewEmailValue;

    if (!foundActive) {
        userDropdown.innerHTML = '<option value="">No active users</option>';
    }
}

async function populateNewsletterTemplateDropdown(profile) {
    const templateDropdown = document.getElementById("newsletterTemplateDropdown");
    const templates = await apiRequest("templates");

    templateDropdown.innerHTML = "";
    let foundActive = false;
    let templateValue = null;
    templates.forEach(template => {
        if (template.stage == "Active") {
            foundActive = true;
            const opt = document.createElement("option");
            opt.value = JSON.stringify({ id: template.id, name: template.friendlyName });
            opt.textContent = template.friendlyName;
            if (profile.preferredTemplate === template.id) {
                templateValue = opt.value;
            }
            templateDropdown.appendChild(opt);
        }
    });
    templateDropdown.value = templateValue;

    if (!foundActive) {
        templateDropdown.innerHTML = '<option value="">No active templates</option>';
    }
}

async function saveProfileDetails() {
    const selectedPreviewEmail = JSON.parse(document.getElementById('previewEmailDropdown').value);
    const selectedTemplate = JSON.parse(document.getElementById('newsletterTemplateDropdown').value);

    const payload = {
        newsletterName: document.getElementById('newsletterName').value || "",
        preferredTemplate: selectedTemplate.id || "",
        businessAddress: document.getElementById('businessAddress').value || "",
        domain: document.getElementById('domain').value || "",
        owner: document.getElementById('owner').value || "",
        ownerEmail: document.getElementById('ownerEmail').value || "",
        replyToEmail: document.getElementById('replyToEmail').value || "",
        senderName: document.getElementById('senderName').value || "",
        senderEmail: document.getElementById('senderEmail').value || "",
        previewEmail: selectedPreviewEmail.email || "",
        previewEmailId: selectedPreviewEmail.id || ""
    };

    const updated = await apiRequest("profile", "PATCH", payload);

    posthog.capture('profile_saved', {
        successful: true
    });
        
    return true;
}

//#endregion

//#region EVENT LISTENERS
window.addEventListener("DOMContentLoaded", async (e) => {
    let local = grabFromLocal("profile");
    setProfileDetails(local);
});

window.addEventListener("authReady", async (e) => {
    const loggedIn = e.detail.valid;
    if (loggedIn) {;
        let token = localStorage.getItem("id_token");
        if (!token) {
            console.warn("No id_token found after auth ready.");
            return null;
        }
        
        getProfileDetails();
    }
});

//#endregion

//#region BUTTONS
// Save profile (update)
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const success = await saveProfileDetails();

    if (success) {
        toastMessage("Profile saved", success);
    } else {
        toastMessage("Error saving profile", success);
    }
});

//#endregion
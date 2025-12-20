//#region INITIALIZE
let pendingContent = null;
let authRetried = false;

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
    const profile = await apiRequest("profile");
    console.log(profile);

    
    // const version = getAPIMode();
    // token = localStorage.getItem("id_token");
    // try {
    //     const response = await fetch(`https://api.dinod2.com/${version}/profile`, {
    //         method: "GET",
    //         headers: {
    //             "Content-Type": "application/json",
    //             Authorization: token
    //         }
    //     });

    //     if (response.status === 401) {
    //     retry(getProfileDetails.name);
    //     } if (!response.ok) {
    //     throw new Error(`Failed to load newsletter: ${response.status}`);
    //     }

    //     const profile = await response.json();

    //     setProfileDetails(profile);

    //     return profile;
    // } catch (err) {
    //     toastMessage("Error loading profile. Please refresh.", false);
    //     console.error("Error loading profile:", err);
    //     return null;
    // }
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
    const version = getAPIMode();
    token = localStorage.getItem("id_token");
    try {
        const response = await fetch(`https://api.dinod2.com/${version}/subscribers`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: token
            }
        });

        if (response.status === 401) {
            retry(populatePreviewEmailDropdown.name);
        } if (!response.ok) {
            const message = "Failed to load subscriber list"
            throw new Error(message);
        }

        const subscribers = await response.json();
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
    } catch (e) {
        console.error(e);
        userDropdown.innerHTML = '<option value="">Error loading users</option>';
    }
}

async function populateNewsletterTemplateDropdown(profile) {
    console.log(profile);
    const templateDropdown = document.getElementById("newsletterTemplateDropdown");
    const version = getAPIMode();
    token = localStorage.getItem("id_token");
    try {
        const response = await fetch(`https://api.dinod2.com/${version}/templates`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: token
            }
        });

        if (response.status === 401) {
            retry(populateNewsletterTemplateDropdown.name);
        } if (!response.ok) {
            const message = "Failed to load newsletter template list"
            throw new Error(message);
        }

        const templates = await response.json();
        console.log(templates);
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
    } catch (e) {
        console.error(e);
        templateDropdown.innerHTML = '<option value="">Error loading templates</option>';
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

    try {
        const version = getAPIMode();
        token = localStorage.getItem("id_token");
        const response = await fetch(`https://api.dinod2.com/${version}/profile`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: token
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            retry(saveProfileDetails.name);
        } if (!response.ok) {
            throw new Error("Failed to save profile");
        }

        posthog.capture('profile_saved', {
            successful: true
        });
        
        return true;
    } catch (err) {
        console.error(err);
        posthog.capture('profile_saved', {
            successful: false
        });
        return false;
    }
}
//#endregion

//#region EVENT LISTENERS
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

window.addEventListener("authIsRetried", async (e) => {
    const theName = e.detail.name;
    window[theName](e);
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
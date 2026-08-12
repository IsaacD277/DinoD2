//#region INITIALIZE
let pendingContent = null;
let profile;
let appSettingsModal = document.getElementById("appSettingsModal");
const form = document.getElementById('profileForm');
const apiCheckbox = document.getElementById("apiSelector");

if (apiCheckbox) {
    apiCheckbox.addEventListener('change', setAPIMode);
}

//#endregion

//#region FUNCTIONS
function initializeAPIMode() {
    // const apiCheckbox = document.getElementById("apiSelector");
    const version = localStorage.getItem("version");
    if (version == "development") {
        // apiCheckbox.checked = true;
    } else {
        // apiCheckbox.checked = false;
    }
}

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
    // Editable fields
    document.getElementById('businessAddress').value = profile.businessAddress || "";
    document.getElementById('owner').value = profile.owner || "";
    document.getElementById('replyToEmail').value = profile.replyToEmail || "";
    document.getElementById('senderEmail').value = profile.senderEmail.slice(0, -11) || "";

    // Read-only fields
    document.getElementById('ownerEmail').value = profile.ownerEmail || "";
    const joinedDate = profile.createdAt ? new Date(profile.createdAt) : null;
    document.getElementById('createdAt').value = joinedDate.toLocaleString("en-US", options) || "";
    document.getElementById('maxSubscribers').value = profile.maxSubscribers || "";
    document.getElementById('plan').value = profile.plan || "";
}

async function saveProfileDetails() {
    const payload = {
        businessAddress: document.getElementById('businessAddress').value || "",
        owner: document.getElementById('owner').value || "",
        ownerEmail: document.getElementById('ownerEmail').value || "",
        replyToEmail: document.getElementById('replyToEmail').value || "",
        senderEmail: `${document.getElementById('senderEmail').value}@dinod2.com` || ""
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
    initializeAPIMode();
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

// window.onclick = function(event) {
//   if (event.target == appSettingsModal) {
//     appSettingsModal.style.display = "none";
//   }
// } 

//#endregion

//#region BUTTONS
// Save profile (update)
document.getElementById("saveProfile").onclick = async () => {
    const success = await saveProfileDetails();

    if (success) {
        toastMessage("Profile saved", success);
    } else {
        toastMessage("Error saving profile", success);
    }
};
//#endregion
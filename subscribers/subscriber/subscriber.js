//#region INITIALIZE
let pendingContent = null;
const subscriberId = getSubscriberId();
const form = document.getElementById('subscriberForm');

//#endregion

//#region FUNCTIONS
function getSubscriberId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('subscriberId');
}

async function getSubscriber() {
    const subscriberId = getSubscriberId();
    const data = await apiRequest(`subscribers/${encodeURIComponent(subscriberId)}`);
    document.getElementById('firstName').value = data.firstName || "";
    document.getElementById('emailAddress').value = data.emailAddress || "";
    document.getElementById('conditionDropdown').value = data.condition || "subscribed";
    document.getElementById('pageTitle').textContent = "Edit Subscriber";
}

async function updateSubscriber() {
    const condition = document.getElementById('conditionDropdown').value;
    const payload = {
        emailAddress: document.getElementById('emailAddress').value || "",
        firstName: document.getElementById('firstName').value || "",
        condition: condition || "Subscribed"
    };

    if (condition === 'Deleted') {
        const data = await apiRequest(`subscribers/${encodeURIComponent(subscriberId)}`, "DELETE");

        toastMessage("Successfully deleted subscriber", true);
    } else {
        const data = await apiRequest(`subscribers/${encodeURIComponent(subscriberId)}`, "PATCH", payload);
        
        toastMessage("Successfully saved changes", true);
        
        posthog.capture('subscriber_updated', {
            subscriberId: subscriberId,
            toCondition: condition,
            successful: true
        });
    }
}

//#endregion

//#region EVENT LISTENERS
window.addEventListener("DOMContentLoaded", async (e) => {
    await getSubscriber();
});

window.addEventListener("authReady", async (e) => {
    const loggedIn = e.detail.valid;
    if (loggedIn) {
        let token = localStorage.getItem("id_token");
        if (!token) {
            console.warn("No id_token found after auth ready.");
            return null;
        }
        await getSubscriber();
    }
});

//#endregion

//#region BUTTONS
// Save subscriber (update)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateSubscriber();
});

document.getElementById('backBtn').onclick = () => {
    posthog.capture('subscribersPage_visit');
    window.location.href = "/subscribers/";
};

//#endregion
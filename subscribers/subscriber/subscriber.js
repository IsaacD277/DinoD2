//#region INITIALIZE
let pendingContent = null;
let authRetried = false;
const subscriberId = getSubscriberId();
const form = document.getElementById('subscriberForm');

//#endregion

//#region FUNCTIONS
function getSubscriberId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('subscriberId');
}

async function getSubscriber() {
    const version = getAPIMode();
    const subscriberId = getSubscriberId();
    token = localStorage.getItem("id_token")
    try {
        const response = await fetch(`https://api.dinod2.com/${version}/subscribers/${encodeURIComponent(subscriberId)}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: token
            }
        });

        if (response.status === 401) {
            retry();
        } if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        } else {
            const data = await response.json();
            document.getElementById('firstName').value = data.firstName || "";
            document.getElementById('emailAddress').value = data.emailAddress || "";
            document.getElementById('conditionDropdown').value = data.condition || "subscribed";
            document.getElementById('pageTitle').textContent = "Edit Subscriber";
        }
    } catch (error) {
        console.error("Error fetching subscribers:", error);
        return null;
    }
}

async function updateSubscriber() {
    const condition = document.getElementById('conditionDropdown').value;
    const payload = {
        emailAddress: document.getElementById('emailAddress').value || "",
        firstName: document.getElementById('firstName').value || "",
        condition: condition || "Subscribed"
    };

    try {
        if (condition === 'Deleted') {
            const version = getAPIMode();
            const response = await fetch(`https://api.dinod2.com/${version}/subscribers/${encodeURIComponent(subscriberId)}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token
                }
            });

            if (response.status === 401) {
                retry();
            } if (!response.ok) {
                throw new Error(`Failed to delete subscriber`);
            }

            toastMessage("Successfully deleted subscriber", true);

            return;
        } else {
            const version = getAPIMode();
            const response = await fetch(
                `https://api.dinod2.com/${version}/subscribers/${encodeURIComponent(subscriberId)}`,
                {
                method: "PATCH",
                headers: {
                "Content-Type": "application/json",
                Authorization: token
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 401) {
                retry();
            } if (!response.ok) {
                throw new Error("Failed to save subscriber");
            }

            toastMessage("Successfully saved changes", true);

            return;
        }
    } catch (err) {
        console.error(err);
        toastMessage("Failed to save changes", false);
        return;
    }
}

//#endregion

//#region EVENT LISTENERS
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
  window.location.href = "/subscribers/";
};

//#endregion
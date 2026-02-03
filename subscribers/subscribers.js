//#region INITIALIZE
const form = document.getElementById("addaSubscriber");
const searchInput = document.getElementById("search");
var addSubscriberModal = document.getElementById("addSubscriberModal");
let subscribers;
let profile;

//#endregion

//#region FUNCTIONS
function compare( a, b ) {
  if ( a.created < b.created ){
    return 1;
  }
  if ( a.created > b.created ){
    return -1;
  }
  return 0;
}

async function getSubscribers() {
    subscribers = await apiRequest("subscribers")
    subscribers.sort(compare);
    totalSubscribers(subscribers);
    renderSubscribers(subscribers);
    saveToLocalStorage("subscribers", subscribers);
}

// Render list in the <ul>
function renderSubscribers(subscribers, filter = "") {
    const table = document.getElementById("subscribersTable");
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";

    if (!subscribers || subscribers.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5'>No subscribers yet.</td></tr>";
        return;
    }

    const options = {
        timeZone: "America/New_York",
        year: "numeric",
        month: "short",
        day: "numeric"
    };

    if (filter) {
        subscribers = subscribers.filter((subscriber) => (subscriber.firstName.toLowerCase().includes(filter)) || (subscriber.emailAddress.toLowerCase().includes(filter)) || (subscriber.created.includes(filter)) || (subscriber.condition.toLowerCase().includes(filter)))
    }

    subscribers.forEach(sub => {
        const subscribeDate = sub.created ? new Date(sub.created) : null;
        const tr = document.createElement("tr");

        const selection = document.createElement("td");
        selection.innerHTML = '<input type="checkbox" name="select">'

        const nameTd = document.createElement("td");
        nameTd.textContent = sub.firstName || "";

        const emailTd = document.createElement("td");
        emailTd.textContent = sub.emailAddress || "";

        const joinedTd = document.createElement("td");
        joinedTd.textContent = subscribeDate && !isNaN(subscribeDate)
            ? subscribeDate.toLocaleString("en-US", options)
            : "unknown";

        const statusTd = document.createElement("td");
        statusTd.textContent = sub.condition || "";

        // tr.appendChild(selection);
        tr.appendChild(nameTd);
        tr.appendChild(emailTd);
        tr.appendChild(joinedTd);
        tr.appendChild(statusTd);

        tr.addEventListener ("click", () => {
            posthog.capture('subscriberEditorPage_visit', {
                subscriberId: sub.id
            });
            window.location.href = `/subscribers/subscriber/?subscriberId=${sub.id}`;
        })

        tbody.appendChild(tr);
    });
}

function totalSubscribers(subscribers) {
    if (!subscribers) return 0;
    if (Array.isArray(subscribers)) {
        const total = subscribers.filter(sub => sub.condition == "Subscribed").length;
        const heading = document.getElementById("subscribersHeading");
        heading.textContent = `${total} Subscriber${total === 1 ? "" : "s"}`;
    }
}

async function getProfileDetails() {
    profile = await apiRequest("profile");
    saveToLocalStorage("profile", profile);
    console.log(profile);
}

//#endregion

//#region EVENT LISTENERS
window.addEventListener("DOMContentLoaded", async (e) => {
    let local = grabFromLocal("subscribers");
    totalSubscribers(local);
    renderSubscribers(local);
})

window.addEventListener("authReady", async (e) => {
    const loggedIn = e.detail.valid;
    if (loggedIn) {
        let token = localStorage.getItem("id_token");
        if (!token) {
            console.warn("No id_token found after auth ready.");
            return null;
        }
        getSubscribers();
        getProfileDetails();
    }
});

searchInput.addEventListener("input", (e) => {
    let value = e.target.value.toLowerCase().trim();
    if (value) {
        renderSubscribers(subscribers, value);
    } else {
        renderSubscribers(subscribers);
    }
});

//#endregion

//#region BUTTONS
document.getElementById("addSubscriber").onclick = () => {
    let url = profile.signupURL;
    if (url) {
        window.open(url, '_blank').focus();
    } else {
        toastMessage("No signup page created. Email support@isaacd2.com", false)
    }
}
//#endregion

//#region INITIALIZE
let authRetried = false;
const form = document.getElementById("addaSubscriber");

//#endregion

//#region FUNCTIONS
function getAPIMode() {
    const version = localStorage.getItem("version");
    if (!version) {
        localStorage.setItem("version", "v0");
        const version = localStorage.getItem("version");
    }
    return version;
}

function retry() {
    if (!authRetried) {
        authRetried = true;
        const retryAuth = new CustomEvent("retryAuth", {
            detail: {
                retried: true,
            },
        });

        window.dispatchEvent(retryAuth);
    };
}

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
    const version = getAPIMode();
    token = localStorage.getItem("id_token")
    try {
        const response = await fetch(`https://api.dinod2.com/${version}/subscribers`, {
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
            const subscribers = await response.json();
            subscribers.sort(compare);
            totalSubscribers(subscribers);
            renderSubscribers(subscribers);
        }
    } catch (error) {
        console.error("Error fetching subscribers:", error);
        return null;
    }
}

// Render list in the <ul>
function renderSubscribers(subscribers) {
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

    subscribers.forEach(sub => {
        const subscribeDate = sub.created ? new Date(sub.created) : null;
        const tr = document.createElement("tr");

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

        tr.appendChild(nameTd);
        tr.appendChild(emailTd);
        tr.appendChild(joinedTd);
        tr.appendChild(statusTd);

        tr.addEventListener ("click", () => {
            window.location.href = `/subscribers/subscriber/?subscriberId=${sub.id}`;
        })

        tbody.appendChild(tr);
    });
}

function totalSubscribers(subscribers) {
    if (!subscribers) return 0;
    if (Array.isArray(subscribers)) {
        const total = subscribers.length;
        const heading = document.getElementById("subscribersHeading");
        heading.textContent = `${total} Subscriber${total === 1 ? "" : "s"}`;
    }
    
}

//#endregion

//#region EVENT LISTENERS
window.addEventListener("DOMContentLoaded", async (e) => {
    let token = localStorage.getItem("id_token");
    if (!token) {
        console.warn("No id_token found after auth ready.");
        return null;
    }
    getAPIMode();
    getSubscribers();
})

window.addEventListener("authReady", async (e) => {
    const loggedIn = e.detail.valid;
    if (loggedIn) {
        let token = localStorage.getItem("id_token");
        if (!token) {
            console.warn("No id_token found after auth ready.");
            return null;
        }
        getAPIMode();
        getSubscribers();
    }
});
//#endregion

//#region BUTTONS
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const emailAddress = document.getElementById('emailAddress').value
        const firstName = document.getElementById('firstName').value
        if ((emailAddress || firstName) === (null || undefined || "")) {
            throw new Error("No name or email address for new subscriber.");
        }

        const payload = {
            emailAddress: emailAddress,
            firstName: firstName
        };
        version = getAPIMode();
        token = localStorage.getItem("id_token");
        const response = await fetch(`https://api.dinod2.com/${version}/subscribers`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: token
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            retry();
        } if (!response.ok) {
            throw new Error(`HTTP error! Stage: ${response.stage}`);
        }

        data = await response.json();
        document.getElementById('emailAddress').value = "";
        document.getElementById('firstName').value = "";
        getSubscribers();

    } catch (error) {
        console.error(error);
        return null
    }
});

document.getElementById("profileBtn").addEventListener("click", () => {
    window.location.href = `/profile/`;
});

//#endregion
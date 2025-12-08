//#region INITIALIZE
let token = null;
let authRetried = false;
//#endregion

//#region FUNCTIONS
function getAPIMode() {
    const version = localStorage.getItem("version");
    if (!version) {
        localStorage.setItem("version", "v0"); // "v0"
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
  if ( a.sendDate < b.sendDate ){
    return 1;
  }
  if ( a.sendDate > b.sendDate ){
    return -1;
  }
  return 0;
}

function truncate(input, maxCharacters) {
    if (input.length > maxCharacters) {
        return input.substring(0,maxCharacters-2) + '...';
    }
    return input;
}

async function getNewsletters() {
    const version = getAPIMode();
    token = localStorage.getItem("id_token");
    try {
        const response = await fetch(`https://api.dinod2.com/${version}/newsletters`, {
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
        };

        const newsletters = await response.json();
        newsletters.sort( compare );
        console.log(newsletters);
        renderNewsletterCards(newsletters);
    } catch (error) {
        console.error("Error fetching newsletters:", error);
        return null;
    }
}

function renderNewsletterCards(newsletters) {
    const cards = document.getElementById("newsletterCards");

    if (!newsletters) {
        cards.innerHTML = "<p>No newsletters yet.</p>";
        return;
    }

    cards.innerHTML = ``

    newsletters.forEach(newsletter => {
        const card = document.createElement("div");
        card.id = newsletter.id;
        card.className = "card";

        const content = document.createElement("div");
        content.innerHTML = `
            <p class="subject">${newsletter.subject ? truncate(newsletter.subject, 35) : "Untitled"}</p>
            <p class="preview">${newsletter.preview ? truncate(newsletter.preview, 50) : "No Preview"}</p>
            <div class="bottom">
                <div class="statusRectangle">
                    <p class="status">${newsletter.stage}</p>
                </div>
                <div class="sendDateRectangle">
                    <p class="sendDate">${newsletter.sendDate ? newsletter.sendDate : "No Send Date"}</p>
                </div>
            </div>
        `;

        card.appendChild(content);
        
        card.addEventListener ("click", () => {
            window.location.href = `/newsletter/?newsletterId=${newsletter.id}`;
        })

        cards.appendChild(card);
    
    })
}

async function createNewsletter() {
    const version = getAPIMode();
    token = localStorage.getItem("id_token");
    try {
        const response = await fetch(`https://api.dinod2.com/${version}/newsletters`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: token
            },
            body: JSON.stringify({})
        });

        if (response.status === 401) {
            retry();
        } if (!response.ok) {
            throw new Error(`HTTP error! Stage: ${response.stage}`);
        };

        data = await response.json();
        const newsletterId = data.id;

        posthog.capture('newsletter_created', {
            newsletterId: newsletterId,
        })

        window.location.href = `/newsletter/?newsletterId=${newsletterId}`;

    } catch (error) {
        console.error(error);
        return null
    }
}

//#endregion

//#region EVENT LISTENERS
window.addEventListener("authReady", async (e) => {
    const loggedIn = e.detail.valid;
    if (loggedIn) {
        token = localStorage.getItem("id_token");
        if (!token) {
            console.warn("No id_token found after auth ready.");
            return null;
        }
        getAPIMode();
        getNewsletters();
    }
});

//#endregion

//#region BUTTONS
document.getElementById("addNewsletter").addEventListener("click", async () => {
    await createNewsletter();
});

//#endregion
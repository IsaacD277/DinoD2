//#region INITIALIZE
let token = null;
let authRetried = false;
let newsletters;
//#endregion

//#region FUNCTIONS
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
    let newsletters = await apiRequest("newsletters");
    newsletters.sort( compare );
    console.log(newsletters);
    renderNewsletterCards(newsletters);
    saveToLocalStorage("newsletters", newsletters);
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
            posthog.capture('newsletterEditorPage_visit', {
                newsletterId: newsletter.id
            });
            window.location.href = `/newsletter/?newsletterId=${newsletter.id}`;
        })

        cards.appendChild(card);
    
    })
}

async function createNewsletter() {
    const data = await apiRequest("newsletters", "POST", {})
    const newsletterId = data.id;

    posthog.capture('newsletter_created', {
        newsletterId: newsletterId,
        successful: true
    })

    window.location.href = `/newsletter/?newsletterId=${newsletterId}`;
}

//#endregion

//#region EVENT LISTENERS
window.addEventListener("DOMContentLoaded", async (e) => {
    let local = grabFromLocal("newsletters");
    renderNewsletterCards(local);
});

window.addEventListener("authReady", async (e) => {
    const loggedIn = e.detail.valid;
    if (loggedIn) {
        token = localStorage.getItem("id_token");
        if (!token) {
            console.warn("No id_token found after auth ready.");
            return null;
        }
        getNewsletters();
    }
});

//#endregion

//#region BUTTONS
document.getElementById("addNewsletter").addEventListener("click", async () => {
    await createNewsletter();
});

//#endregion
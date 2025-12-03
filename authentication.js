//#region INITIALIZE
// Set variables
let authResolved = false;
const authReady = new CustomEvent("authReady", {
    detail: {
        valid: true,
    },
});
const authNotReady = new CustomEvent("authReady", {
    detail: {
        valid: false,
    },
});

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const isDev = window.location.hostname === "dev.dinod2.com";
const clientId = "7tdooqkb19uncgla4rvu4922dp";
const domain = "https://auth.dinod2.com";
const redirectUri = isLocal ? "http://localhost:5500" : isDev ? "https://dev.dinod2.com" : "https://app.dinod2.com"; // must match Cognito app settings
const logoutUri = isLocal ? "http://localhost:5500" : isDev ? "https://dev.dinod2.com" : "https://app.dinod2.com"; // must match Cognito app settings
const scope = "aws.cognito.signin.user.admin+email+openid+phone"; // must match Cognito app settings // USE '+' for spaces
const responseType = "code"; // Implicit flow for static sites

//#endregion

//#region FUNCTIONS

// Pull Login Code from URL after signin
function parseUrl() {
    if (window.location.search) {
        const search = window.location.search.substring(1);
        const params = new URLSearchParams(search);
        const loginCode = params.get("code");
        if (loginCode) {
            localStorage.setItem("loginCode", loginCode);
            window.location.search = ""; // clean URL
        }
    }
}

function setAuthStatus(status = false) {
    if (!authResolved) {
        authResolved = true;
        if (status) {
            window.dispatchEvent(authReady);
        } else {
            window.dispatchEvent(authNotReady);
        }
    }
}

async function checkAuthStatus(forceRefresh = false) {
    // Gather local variables
    const idToken = localStorage.getItem("id_token") || null;

    // If there is not a token, ask Cognito for one
    if (idToken === undefined || idToken === null) {
        const hasToken = await getToken();
        setAuthStatus(hasToken);
        if (!hasToken) {
            localStorage.clear();
            window.location.href = "https://dinod2.com";
        }
        identifyUser();
        return;
    }

    const expiration = localStorage.getItem("expires");
    const requested = localStorage.getItem("requested");
    const currentDate = Math.floor(Date.now() / 1000); // Date.now() returns milliseconds, expiration is in seconds

    if ((((expiration - requested) * 0.75) + parseInt(requested) < currentDate) || forceRefresh) {
        const theRefreshToken = localStorage.getItem("refresh_token");
        const refreshed = await refreshToken(theRefreshToken);
        setAuthStatus(refreshed);
        if (!refreshed) {
            localStorage.clear();
            window.location.href = "https://dinod2.com";
        }
        identifyUser();
        return;
    }

    setAuthStatus(true);
    identifyUser();
    return;
}

async function getToken() {
    const authorizationCode = localStorage.getItem("loginCode");
    // localStorage.removeItem("loginCode") // Might add this back in to prevent "invalid_grant" errors
    if (!authorizationCode) {
        console.warn("No authorization code available to exchange.");
        return false;
    }
    try {
        const response = await fetch(`${domain}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic N3Rkb29xa2IxOXVuY2dsYTRydnU0OTIyZHA6bTc0ZjJtdGpiaTlpZDV0NHVxbDBiYjNhYmdzcGM3bnByMGxqczc0NjY5dTVra2Q1bmp0',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'grant_type': 'authorization_code',
                'client_id': clientId,
                'redirect_uri': redirectUri,
                'code': authorizationCode
            })
        });


        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to get token: ${response.status} ${text}`);
        }

        const tokens = await response.json();
        const date = Math.floor(Date.now() / 1000);

        if (tokens) {
            localStorage.setItem("id_token", tokens.id_token);
            localStorage.setItem("access_token", tokens.access_token);
            localStorage.setItem("refresh_token", tokens.refresh_token);
            localStorage.setItem("requested", date);
            localStorage.setItem("expires", date + tokens.expires_in);
            localStorage.setItem("token_type", tokens.token_type);

            localStorage.removeItem("loginCode");
        }

        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function refreshToken(refreshToken) {
    if (!refreshToken) {
        console.warn("No refresh token available.");
        return false;
    }
    try {
        const response = await fetch(`${domain}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic N3Rkb29xa2IxOXVuY2dsYTRydnU0OTIyZHA6bTc0ZjJtdGpiaTlpZDV0NHVxbDBiYjNhYmdzcGM3bnByMGxqczc0NjY5dTVra2Q1bmp0',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'grant_type': 'refresh_token',
                'client_id': clientId,
                'refresh_token': refreshToken
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to refresh token: ${response.status} ${text}`);
        }

        const tokens = await response.json();

        if (tokens) {
            localStorage.setItem("id_token", tokens.id_token);
            localStorage.setItem("access_token", tokens.access_token);
            localStorage.setItem("requested", Math.floor(Date.now() / 1000));
            localStorage.setItem("expires", Math.floor(Date.now() / 1000) + tokens.expires_in);
            localStorage.setItem("token_type", tokens.token_type);
        }

        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

function identifyUser() {
    const token = localStorage.getItem("id_token");

    if (token) {
        const arrayToken = token.split('.');
        const tokenPayload = JSON.parse(atob(arrayToken[1]));
        posthog.identify(
            tokenPayload.sub,  // Replace 'distinct_id' with your user's unique identifier
            { email: tokenPayload.email } // optional: set additional person properties
        );
    } else {
        console.error("No token found");
    };
}

//#endregion

//#region EVENT LISTENERS

// Run on page load
parseUrl();

// Requires a small delay or else receives 400 "invalid_grant" errors
setTimeout(() => {
    checkAuthStatus();
}, 50);

window.addEventListener("retryAuth", async (e) => {
    console.log("Retrying Auth");
    authResolved = false;

    // Run on page load
    parseUrl();

    // Requires a small delay or else receives 400 "invalid_grant" errors
    setTimeout(() => {
        checkAuthStatus(true);
    }, 50);
});

//#endregion

//#region BUTTONS
// Login Button
// document.getElementById("loginBtn").onclick = () => {
//     localStorage.clear();
//     const theUrl = `${domain}/login?response_type=${responseType}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
//     window.location.assign(theUrl);
// };

// Logout Button
document.getElementById("logoutBtn").onclick = () => {
    localStorage.clear();
    window.location.href = `${domain}/logout?response_type=${responseType}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
};

document.getElementById("profileBtn").addEventListener("click", () => {
    window.location.href = `/profile/`;
});

document.getElementById("subscribersBtn").addEventListener("click", () => {
    window.location.href = `/subscribers/`;
})

document.getElementById("newslettersBtn").addEventListener("click", () => {
    window.location.href = '/';
});

document.getElementById("logo").addEventListener("click", () => {
    window.location.href = '/';
});

//#endregion

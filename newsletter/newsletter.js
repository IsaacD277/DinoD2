//#region INITIALIZE
// Initial values set
let newsletterData = null;
let newsletter = null;
var singleSendModal = document.getElementById("singleSendModal");
var preview = document.getElementById("previewContainer");
const previewWindow = document.querySelector("iframe").contentWindow;
const iframe = document.getElementById("newsletterEditor");
let profile;
const saving = "Saving...";
const notSaved = "Not Saved";
const saved = "Saved";
const newsletterId = getNewsletterId();

//#endregion

//#region FUNCTIONS
function getNewsletterId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('newsletterId');
}

async function getStats() {
  const data = await apiRequest(`stats/${encodeURIComponent(newsletterId)}`);

  document.getElementById('sendCount').textContent = data.sent || "0";
  document.getElementById('openRate').textContent = data.openRate ? (data.openRate) + "%" : "0%";
}

async function loadNewsletterData(newsletterId) {
  const newsletter = await apiRequest(`newsletters/${encodeURIComponent(newsletterId)}`);
  setNewsletterDetails(newsletter);
  return newsletter;
}

function setNewsletterDetails(newsletter) {
  newsletterData = newsletter.content || "";
  document.getElementById('pageTitle').textContent = newsletter.subject || "Click here to edit the subject";
  document.getElementById('previewMessageEdit').textContent = newsletter.preview || "Click here to edit the preview message";

  if (newsletter.stage == "Sent") {
    document.getElementById("sendToEveryone").style.color = "#767676"
    document.getElementById("alreadySent").textContent = "This newsletter cannot be sent to everyone twice"
  } else {
    document.getElementById("alreadySent").style.visibility = "hidden"
  }

  sendNewsletterContent(newsletterData);
}

function sendNewsletterContent(content) {
  let syncData = {
    "content": content
  }
  iframe.contentWindow.postMessage(syncData, "*");
}

async function saveNewsletter() {
  subject = document.getElementById('pageTitle').innerText || "";
  preview = document.getElementById('previewMessageEdit').innerText || "";
  if (preview == "Click here to edit the preview message") {
    preview = ""
  };
  template = "1fc8d430-4f93-478c-8ecc-c47807f1ab07";

  const payload = {
    subject: subject,
    preview: preview,
    content: newsletterData,
    template: template
  };
  document.getElementById("saveStatus").innerText = saving;
  const data = await apiRequest(`newsletters/${encodeURIComponent(newsletterId)}`, "PATCH", payload);
  document.getElementById("saveStatus").innerText = saved;

  posthog.capture('newsletter_saved', {
    newsletterId: newsletterId,
    successful: true,
    payload: payload,
    errorMessage: null
  });

  // Update local variable
  Object.assign(newsletter, payload);
}

async function sendPreviewEmail(event, previewEmail = true, emailAddress = null, userId = null) {
  await saveNewsletter();

  payload = {
    newsletterId: newsletterId,
    previewEmail: previewEmail,
    emailAddress: emailAddress,
    userId: userId
  }

  await apiRequest("email", "POST", payload);
  return true;
}

async function broadcastEmail() {
  await saveNewsletter();

  const payload = {
    newsletterId: newsletterId
  };

  if (newsletter.stage !== "Draft") {
    const message = "This newsletter has already been sent";
    toastMessage(message, false);
    console.error(message);
    return
  }

  await apiRequest("emailAll", "POST", payload);
  newsletter.stage = "Sent";

  if (newsletter.stage == "Sent") {
    document.getElementById("sendToEveryone").style.color = "#767676";
    document.getElementById("alreadySent").textContent = "This newsletter cannot be sent to everyone twice";
    document.getElementById("alreadySent").style.visibility = "visible";
  }
  return true;
}

async function deleteNewsletter() {
  await apiRequest(`newsletters/${encodeURIComponent(newsletterId)}`, "DELETE")
  return true;
}

async function getProfileDetails() {
  const profile = await apiRequest("profile");
  populateSubscriberListDropdown(profile);
  return profile;
}

async function populateSubscriberListDropdown(profile) {
  const userDropdown = document.getElementById("subscriberListDropdown");

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

function selectElementContents(element) {
  var range = document.createRange();
  range.selectNodeContents(element);
  var select = window.getSelection();
  range.collapse(false);
  select.removeAllRanges();
  select.addRange(range);
}
//#endregion

//#region EVENT LISTENERS
// Setup page once authorization is verified
window.addEventListener("authReady", async (e) => {
  const loggedIn = e.detail.valid;
  if (loggedIn) {
    token = localStorage.getItem("id_token");
    if (!token) {
      console.warn("No id_token found after auth ready.");
      return null;
    }
    newsletter = await loadNewsletterData(newsletterId);
    profile = getProfileDetails();
  }
});

window.addEventListener("DOMContentLoaded", async (e) => {
  let localNewsletters = grabFromLocal("newsletters");
  let localNewsletter = localNewsletters.find(({ id }) => id === newsletterId);
  setNewsletterDetails(localNewsletter);
  token = localStorage.getItem("id_token");
  if (!token) {
    console.warn("No id_token found after auth ready.");
    return null;
  }
  newsletter = await loadNewsletterData(newsletterId);
  profile = getProfileDetails();
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target == singleSendModal) {
    singleSendModal.style.display = "none";
  }
}

document.getElementById("pageTitle").onblur = () => {
  document.getElementById("saveStatus").innerText = notSaved;
  saveNewsletter();
}

document.getElementById("previewMessageEdit").onblur = () => {
  document.getElementById("saveStatus").innerText = notSaved;
  saveNewsletter();
}

document.getElementById('pageTitle').addEventListener('keydown', function (e) {
  if (e.key == "Enter") {    // if Enter has been pressed
    e.preventDefault();
    e.target.blur();
  }
});

document.getElementById('previewMessageEdit').addEventListener('keydown', function (e) {
  if (e.key == "Enter") {    // if Enter has been pressed
    e.preventDefault();
    e.target.blur();
  }
});
//#endregion

//#region BUTTONS
document.getElementById("editPencil").onclick = () => {
  let pencil = document.getElementById("pageTitle");
  pencil.focus(); selectElementContents(pencil);
  document.getElementById("saveStatus").innerText = notSaved;
}

document.getElementById("editPencilPreview").onclick = () => {
  let pencil = document.getElementById("previewMessageEdit");
  pencil.focus(); selectElementContents(pencil);
  document.getElementById("saveStatus").innerText = notSaved;
}

document.getElementsByClassName("close")[0].onclick = () => {
  singleSendModal.style.display = "none";
}

document.getElementById("sendToOne").onclick = () => {
  singleSendModal.style.display = "block";
};

document.getElementById("submitSend").onclick = async (event) => {
  const selectedSubscriberEmail = JSON.parse(document.getElementById('subscriberListDropdown').value);
  singleSendModal.style.display = "none";
  const success = await sendPreviewEmail(event, false, selectedSubscriberEmail.email, selectedSubscriberEmail.id);

  posthog.capture('newsletter_single_send', {
    newsletterId: newsletterId,
    recipientEmail: selectedSubscriberEmail.email,
    recipientUserId: selectedSubscriberEmail.id,
    successful: success
  });

  if (success) {
    toastMessage(`Email sent to ${selectedSubscriberEmail.email}`, true);
  } else {
    toastMessage("Failed to send email", false);
  }
}

document.getElementById("sendToOne").onclick = async (event) => {
  singleSendModal.style.display = "block";
};

document.getElementById("sendToEveryone").onclick = async (event) => {
  if (newsletter.stage !== "Draft") {
    const message = "This newsletter has already been sent";
    toastMessage(message, false);
    console.error(message);
    return
  }

  if (confirm("This action cannot be undone.\nAre you sure you want to continue?")) {
    const success = await broadcastEmail(event);

    posthog.capture('newsletter_broadcast', {
      newsletterId: newsletterId,
      successful: success
    });

    if (success) {
      toastMessage("Sent newsletter to all subscribers", success);
    } else {
      toastMessage("Failed to send newsletter", success);
    }
  }
};

document.getElementById("deleteNewsletter").onclick = async () => {
  if (confirm("This action cannot be undone.\nAre you sure you want to delete?")) {
    toastMessage("Deleting newsletter...", true);
    const success = await deleteNewsletter();

    posthog.capture('newsletter_deleted', {
      newsletterId: newsletterId,
      successful: success
    });

    if (success) {
      toastMessage("Deleted newsletter", success);
      window.location.href = '/';
    } else {
      toastMessage("Failed to delete newsletter", success);
    }
  }
}
//#endregion

//#region EDITOR SYNC
window.addEventListener("message", (event) => {
  if (event.data.status == "save") {
    newsletterData = event.data.content
    saveNewsletter();
  } else if (event.data.status == "update") {
    document.getElementById("saveStatus").innerText = notSaved;
  }
});
//#endregion
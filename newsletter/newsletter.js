//#region INITIALIZE
// Initial values set
let receiving = false;
let trixInitialized = false;
let newsletterData = null;
let newsletter = null;
let trixAttachmentListener = false;
let form;
let backgroundImageform;
var singleSendModal = document.getElementById("singleSendModal");
var preview = document.getElementById("previewContainer");
const editor = document.querySelector("trix-editor");
let livePreview = false;
const previewWindow = document.querySelector("iframe").contentWindow;
let profile;
let autoSave = null;
let masterAutoSave = null;
const notSaved = "Pending save";
const saved = "Saved";
// Pulls newsletterId from the url
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

  if (newsletter.stage == "Sent") {
    document.getElementById("sendToEveryone").style.color = "#767676"
    document.getElementById("alreadySent").textContent = "This newsletter cannot be sent to everyone twice"
  } else {
    document.getElementById("alreadySent").style.visibility = "hidden"
  }

  loadTrixContent(newsletterData);
}

function loadTrixContent(data) {
  trixInitialized = false;
  if (editor) editor.editor.loadHTML(data || "");
  let selection = editor.editor.getSelectedRange();
  let content = document.getElementById("content").value;
  let syncData = {
      "content": content,
      "selection": selection
  }
  document.getElementById("livePreviewTest").contentWindow.postMessage(syncData);
  trixInitialized = true;
}

function handleTrixInitialize(event) {
  // If data already fetched, load it now
  if (newsletterData) {
    loadTrixContent(newsletterData);
    if (!trixAttachmentListener) {
      trixAttachmentListener = true;
    }
  }
}

async function getUploadURL() {
    const theUrl = await apiRequest("upload");
    return theUrl;
}

async function uploadImage(event = null, image = null) {
    if (!image) {
      image = event.attachment.file;
    }

    console.log(image);

    try {
        responseObject = await getUploadURL();

        console.log("Uploading to: " + responseObject.url + responseObject.fields.key);
        toastMessage("Uploading image...", true);

        const formdata = new FormData();

        formdata.append("Content-Type", image.type);
        formdata.append("key", responseObject.fields.key);
        formdata.append("AWSAccessKeyId", responseObject.fields.AWSAccessKeyId);
        formdata.append("policy", responseObject.fields.policy);
        formdata.append("signature", responseObject.fields.signature);
        formdata.append("file", image);

        const response = await fetch(responseObject.url, {
            method: "POST",
            body: formdata
        });

        if (response.status === 204) {
            const result = await response;
            const imageLink = responseObject.url + responseObject.fields.key;

            if (event) {
              var attributes = {
                  url: imageLink,
                  href: imageLink + "?content-disposition=attachment"
              };

              event.attachment.setAttributes(attributes);
            }

            posthog.capture('newsletter_image_uploaded', {
                newsletterId: newsletterId,
                successful: true,
                imageUrl: imageLink,
                contentType: image.type
            });
            toastMessage("Image uploaded.")

            if (event) {
              return true;
            }
            
            return imageLink;
        } else {
            throw new Error(`HTTP error! Status: ${response.status}`);
        };
    } catch (error) {
        toastMessage("Error uploading image. Try again", false);
        console.error("Error uploading image:", error);
        return false;
    }
}

async function saveNewsletter() {

    subject = document.getElementById('pageTitle').innerText || "";
    content = document.getElementById('content').value || "";
    template = "1fc8d430-4f93-478c-8ecc-c47807f1ab07";

    const payload = {
      subject: subject,
      content: content,
      template: template
    };

    const data = await apiRequest(`newsletters/${encodeURIComponent(newsletterId)}`, "PATCH", payload);

    document.getElementById("saveStatus").innerText = saved;
    // toastMessage("Newsletter saved", true);
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

function safeSubstitute(templateString, data) {
  // Use a regular expression to find all ${placeholder} patterns
  return templateString.replace(/\${(.*?)}/g, (match, key) => {
    // Check if the key exists in the data object
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return data[key];
    }
    // If the key is missing, return the original placeholder intact (safe substitution)
    return match;
  });
}

function adjustContentProperties(content) {
  // Replace H1 Tags with H2 Tags
  content = content.replace(/<h1(\s*[^>]*)>/g, "<h2$1>");
  content = content.replace(/<\/h1>/g, "</h2>");
  
  // // Make images fit again
  // const pattern = /<img(?<attrs>.*?)>/gs;

  // function replacer(match, attrs) {
  //   // Remove existing width and height attributes
  //   let modifiedAttrs = attrs.replace(/width="\d+"/gi, '');
  //   modifiedAttrs = modifiedAttrs.replace(/height="\d+"/gi, '');

  //   // The desired inline style
  //   const newStyle = 'width: 500px; height: auto;';

  //   // Check if an existing style attribute exists
  //   if (/style="[^"]*"/gi.test(modifiedAttrs)) {
  //     // Append the new style to the existing style
  //     modifiedAttrs = modifiedAttrs.replace(
  //       /style="([^"]*)"/gi,
  //       (match, existingStyles) => {
  //         // Ensure space separation and prevent duplicate styles
  //         const combinedStyle = `${existingStyles.trim()} ${newStyle.trim()}`.trim();
  //         return `style="${combinedStyle}"`;
  //       }
  //     );
  //   } else {
  //     // If no existing style attribute, add a new one
  //     modifiedAttrs += ` style="${newStyle}"`;
  //   }

  //   // Return the modified image tag
  //   return `<img${modifiedAttrs}>`;
  // }
  
  // content = content.replace(pattern, replacer);
  
  // Center Captions
    // I can uncomment this in the future. I need to figure out how to make this part work on the backend first.
    // content = content.replace(/attachment__caption/g, 'attachment__caption\" style=\"text-align: center;');

  return content;
}

function resizeImages(html) {
  const pattern = /<img(?<attrs>.*?)>/gs;

  function replacer(match, attrs) {
    // Remove existing width and height attributes
    let modifiedAttrs = attrs.replace(/width="\d+"/gi, '');
    modifiedAttrs = modifiedAttrs.replace(/height="\d+"/gi, '');

    // The desired inline style
    const newStyle = 'width: 500px; height: auto;';

    // Check if an existing style attribute exists
    if (/style="[^"]*"/gi.test(modifiedAttrs)) {
      // Append the new style to the existing style
      modifiedAttrs = modifiedAttrs.replace(
        /style="([^"]*)"/gi,
        (match, existingStyles) => {
          // Ensure space separation and prevent duplicate styles
          const combinedStyle = `${existingStyles.trim()} ${newStyle.trim()}`.trim();
          return `style="${combinedStyle}"`;
        }
      );
    } else {
      // If no existing style attribute, add a new one
      modifiedAttrs += ` style="${newStyle}"`;
    }

    // Return the modified image tag
    return `<img${modifiedAttrs}>`;
  }

  return html.replace(pattern, replacer);
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
addEventListener("trix-initialize", handleTrixInitialize);

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

        const existingEditor = document.querySelector("trix-editor");
        if (existingEditor && existingEditor.editor) {
            handleTrixInitialize({ target: existingEditor });
        }
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

    const existingEditor = document.querySelector("trix-editor");
    if (existingEditor && existingEditor.editor) {
        handleTrixInitialize({ target: existingEditor });
    }
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == singleSendModal) {
    singleSendModal.style.display = "none";
  }
}

document.getElementById("pageTitle").onblur = () => {
  document.getElementById("saveStatus").innerText = notSaved;
  saveNewsletter();
}

document.getElementById('pageTitle').addEventListener('keydown', function(e) {
  if (e.key == "Enter") {    // if Enter has been pressed
    e.preventDefault();
    e.target.blur();
  }
});
//#endregion

//#region BUTTONS
document.getElementById("editPencil").onclick = () => {
  let pencil = document.getElementById("pageTitle");
  pencil.focus();selectElementContents(pencil);
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
    receiving = true;
    // attachmentFlipper(false);
    if (editor) editor.editor.loadHTML(event.data.content || "");
    editor.editor.setSelectedRange(event.data.selection);
    setTimeout(async () => {
        receiving = false;
    }, 100);
});

addEventListener("trix-change", () => {
    clearTimeout(autoSave);
    if (!receiving) {
        let selection = editor.editor.getSelectedRange();
        let content = document.getElementById("content").value;
        // content = adjustContentProperties(content);
        let data = {
            "content": content,
            "selection": selection
        }
        document.getElementById("livePreviewTest").contentWindow.postMessage(data);
    }
    if (trixInitialized) {
        document.getElementById("saveStatus").innerText = notSaved;
        autoSave = setTimeout(() => {
          saveNewsletter();
          clearTimeout(masterAutoSave);
          clearTimeout(autoSave);
          masterAutoSave = null;
          autoSave = null;
        }, 3000);
        if (masterAutoSave == null) {
          masterAutoSave = setTimeout(() => {
            saveNewsletter();
            clearTimeout(autoSave);
            clearTimeout(masterAutoSave);
            autoSave = null;
            masterAutoSave = null;
          }, 30000);
        }
    }
});

addEventListener("trix-selection-change", () => {
    if (!receiving) {
        let selection = editor.editor.getSelectedRange();
        let content = document.getElementById("content").value;
        let data = {
            "content": content,
            "selection": selection
        }
        document.getElementById("livePreviewTest").contentWindow.postMessage(data);
    }
});

addEventListener("trix-file-accept", () => {
  if (receiving) {
    preventDefault();
  }
});

editor.addEventListener("trix-attachment-add", async (event) => {
    if (event.attachment.file) {
        await uploadImage(event);
    }
});
//#endregion
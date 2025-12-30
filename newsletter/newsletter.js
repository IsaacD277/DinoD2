//#region INITIALIZE
// Initial values set
let trixInitialized = false;
let newsletterData = null;
let newsletter = null;
let authRetried = false;
let form;
let backgroundImageform;
var newsletterSettingsModal = document.getElementById("newsletterSettingsModal");
var singleSendModal = document.getElementById("singleSendModal");
var preview = document.getElementById("previewContainer");
let livePreview = false;
let template = null;
const previewWindow = document.querySelector("iframe").contentWindow;
var splitInstance = Split(['#split-0'], {
    minSize: 500,
    gutterSize: 16,
});
let profile;

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
  document.getElementById('subject').value = newsletter.subject || "Untitled";
  document.getElementById('preview').value = newsletter.preview || "";
  newsletterData = newsletter.content || "";
  document.getElementById('sendDate').value = newsletter.sendDate || "";
  document.getElementById('pageTitle').textContent = "Edit Newsletter";
  let backgroundColor = document.getElementById('backgroundColor').value
  if (newsletter.backgroundColor) {
    backgroundColor = newsletter.backgroundColor.substring(0,7);
  } else {
    backgroundColor = "#000000"
  }

  if (newsletter.stage == "Sent") {
    document.getElementById("sendToEveryone").style.color = "#767676"
    document.getElementById("alreadySent").textContent = "This newsletter cannot be sent to everyone twice"
  } else {
    document.getElementById("alreadySent").style.visibility = "hidden"
  }

  if (trixInitialized) {
    loadTrixContent(newsletterData);
  }
}

async function loadNewsletter() {
  // If Trix already ready, load immediately
  if (trixInitialized) {
    loadTrixContent(data.content);
  }
}

function loadTrixContent(data) {
  const editor = document.querySelector("trix-editor");
  if (editor) editor.editor.loadHTML(data || "");
}

function handleTrixInitialize(event) {
    trixInitialized = true;
    // If data already fetched, load it now
    if (newsletterData) {
      loadTrixContent(newsletterData);
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

async function saveNewsletter(event) {
    event.preventDefault();
    const selectedTemplate = JSON.parse(document.getElementById('newsletterTemplateDropdown').value);

    subject = document.getElementById('subject').value || "";
    preview = document.getElementById('preview').value || "";
    content = document.getElementById('content').value || "";
    sendDate = document.getElementById('sendDate').value || "";
    template = selectedTemplate.id || "1fc8d430-4f93-478c-8ecc-c47807f1ab07";

    const payload = {
      subject: subject,
      preview: preview,
      content: content,
      sendDate: sendDate,
      template: template
    };

    const data = await apiRequest(`newsletters/${encodeURIComponent(newsletterId)}`, "PATCH", payload);

    toastMessage("Newsletter saved", true);
    posthog.capture('newsletter_saved', {
      newsletterId: newsletterId,
      successful: true,
      payload: payload,
      errorMessage: null
    });

    // Update local variable
    Object.assign(newsletter, payload);
}

async function updateSettings() {
    sendDate = document.getElementById('sendDate').value || "";
    const selectedTemplate = JSON.parse(document.getElementById('newsletterTemplateDropdown').value);
    template = selectedTemplate.id || "";
    color = `${document.getElementById('backgroundColor').value}d7` || "#240b0bd7";

    const payload = {
      sendDate: sendDate,
      template: template,
      backgroundColor: color
    };

    const data = await apiRequest(`newsletters/${encodeURIComponent(newsletterId)}`, "PATCH", payload);
    toastMessage("Updated settings", true);

    // Update local sendDate
    newsletter.sendDate = sendDate;
    newsletter.template = template;
    await getTemplate();
    await updatePreview(template);
}

async function updateBackgroundImage(event) {
    event.preventDefault();

    let image = document.getElementById("backgroundImage").files[0];

    const link = await uploadImage(null, image);
    console.log(link);

    const payload = {
        backgroundImageUrl: link
    };

    const data = await apiRequest(`newsletters/${encodeURIComponent(newsletterId)}`, "PATCH", payload);

    toastMessage("Updated background image", true);

    await getTemplate();
    await updatePreview(template);
}

async function sendPreviewEmail(event, previewEmail = true, emailAddress = null, userId = null) {
  await saveNewsletter(event);

  payload = {
    newsletterId: newsletterId,
    previewEmail: previewEmail,
    emailAddress: emailAddress,
    userId: userId
  }

  await apiRequest("email", "POST", payload);
  return true;
}

async function broadcastEmail(event) {
  await saveNewsletter(event);

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

async function getTemplate() {
    const data = await apiRequest(`templates/${encodeURIComponent(newsletter.template)}`);

    const response = await fetch(data.s3Url);

    template = await response.text();
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

async function updatePreview(templateString) {
    let content = document.getElementById("content").value;
    content = adjustContentProperties(content);
    const data = {
        tracking_url: "",
        preview: newsletter.preview,
        content: content,
        businessAddress: "Address not available in preview only",
        backgroundImageUrl: newsletter.backgroundImageUrl || "",
        backgroundColor: newsletter.backgroundColor || ""
    };
    const previewData = safeSubstitute(templateString, data);
    previewWindow.postMessage(previewData);
}

function adjustContentProperties(content) {
  // Replace H1 Tags with H2 Tags
  content = content.replace(/<h1(\s*[^>]*)>/g, "<h2$1>");
  content = content.replace(/<\/h1>/g, "</h2>");
  
  // Make images fit again
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
  
  content = content.replace(pattern, replacer);
  
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

async function populateNewsletterTemplateDropdown() {
    const templateDropdown = document.getElementById("newsletterTemplateDropdown");
    const templates = await apiRequest("templates");

    templateDropdown.innerHTML = "";
    let foundActive = false;
    let templateValue = null;
    templates.forEach(template => {
        if (template.stage == "Active") {
            foundActive = true;
            const opt = document.createElement("option");
            opt.value = JSON.stringify({ id: template.id, name: template.friendlyName });
            opt.textContent = template.friendlyName;
            if (newsletter.template === template.id) {
                templateValue = opt.value;
            }
            templateDropdown.appendChild(opt);
        }
    });
    templateDropdown.value = templateValue;

    if (!foundActive) {
        templateDropdown.innerHTML = '<option value="">No active templates</option>';
    }
}

function setSplit(preview = false) {  
  if (preview) {
    splitInstance = Split(['#split-0', '#split-1'], {
      minSize: [500, 100],
      gutterSize: 16,
    });
    document.getElementById('split-1').style.display = "flex";
    document.getElementById('newsletterStats').style.display = "none";
    document.getElementById('formSubject').style.display = "none";
    document.getElementById('formPreview').style.display = "none";
    document.getElementById('livePreviewNewsletter').textContent = "Hide Live Preview";
  } else {
    splitInstance.destroy(preserveStyles = true);
    splitInstance = Split(['#split-0'], {
                        minSize: 500,
                        gutterSize: 16,
                    });
    document.getElementById('split-1').style.display = "none";
    document.getElementById('newsletterStats').style.display = "flex";
    document.getElementById('formSubject').style.display = "block";
    document.getElementById('formPreview').style.display = "block";
    document.getElementById('livePreviewNewsletter').textContent = "Show Live Preview";
  }
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

        form = document.getElementById('newsletterForm');
        newsletter = await loadNewsletterData(newsletterId);
        await getStats();
        getTemplate();
        populateNewsletterTemplateDropdown();
        profile = getProfileDetails();

        if (form) {
          form.addEventListener("submit", saveNewsletter);
        }

        const existingEditor = document.querySelector("trix-editor");
        if (existingEditor && existingEditor.editor) {
            handleTrixInitialize({ target: existingEditor });
        }
    }
});

window.addEventListener("DOMContentLoaded", async (e) => {
    token = localStorage.getItem("id_token");
    if (!token) {
        console.warn("No id_token found after auth ready.");
        return null;
    }

    form = document.getElementById('newsletterForm');
    newsletter = await loadNewsletterData(newsletterId);
    await getStats();
    getTemplate();
    populateNewsletterTemplateDropdown();
    profile = getProfileDetails();

    if (form) {
      form.addEventListener("submit", saveNewsletter);
    }

    const existingEditor = document.querySelector("trix-editor");
    if (existingEditor && existingEditor.editor) {
        handleTrixInitialize({ target: existingEditor });
    }
});

// Upload image when added to Trix
addEventListener("trix-attachment-add", (event) => {
  uploadImage(event);
});

addEventListener("trix-change", () => {
  if (livePreview) {
    updatePreview(template);
  }
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == newsletterSettingsModal) {
    newsletterSettingsModal.style.display = "none";
  }

  if (event.target == singleSendModal) {
    newsletterSettingsModal.style.display = "none";
  }
} 

document.getElementById("backgroundImage").onchange = (event) => {
  updateBackgroundImage(event);
}

//#endregion

//#region BUTTONS
document.getElementById('backBtn').onclick = () => {
  posthog.capture('newslettersPage_visit');
  window.location.href = "/";
};

document.getElementById("changeSettings").onclick = () => {
  newsletterSettingsModal.style.display = "block";
};

document.getElementById("submitSettings").onclick = async => {
  updateSettings();
  newsletterSettingsModal.style.display = "none";
}

document.getElementsByClassName("close")[0].onclick = () => {
  newsletterSettingsModal.style.display = "none";
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

document.getElementById("previewNewsletter").onclick = async (event) => {
  if (confirm("You are sending an email to yourself to preview.\nAre you sure you want to continue?")) {
    const success = await sendPreviewEmail(event);

    posthog.capture('newsletter_previewed', {
      newsletterId: newsletterId,
      successful: success
    });

    if (success) {
      toastMessage("Preview email sent", true);
    } else {
      toastMessage("Failed to send preview", false);
    }
  }
};

document.getElementById("sendToOne").onclick = async (event) => {
  singleSendModal.style.display = "block";
};

document.getElementById("livePreviewNewsletter").onclick = async (event) => {
  livePreview = livePreview ? false : true;
  livePreview ? getTemplate() : null;
  livePreview ? setSplit(true) : setSplit(false);
  updatePreview(template);
}

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

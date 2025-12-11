//#region INITIALIZE
// Initial values set
let trixInitialized = false;
let newsletterData = null;
let newsletter = null;
let authRetried = false;
let form;
var modal = document.getElementById("sendDateModal");
var preview = document.getElementById("previewContainer");
let livePreview = false;
let template = null;
const targetWindow = document.querySelector("iframe").contentWindow;

// Allows for production and development switching
const version = getAPIMode();

// Pulls newsletterId from the url
const newsletterId = getNewsletterId();

//#endregion

//#region FUNCTIONS
function getNewsletterId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('newsletterId');
}

function getStats() {
    const version = getAPIMode();
    token = localStorage.getItem("id_token");
    fetch(`https://api.dinod2.com/${version}/stats/${encodeURIComponent(newsletterId)}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: token
        }
    })
    .then(res => {
        if (res.status === 401) {
            retry();
        }
        if (!res.ok) throw new Error("Failed to load stats");
        return res.json();
    })
    .then(data => {
        // Handle stats data here
        document.getElementById('sendCount').textContent = data.sent || "0";
        document.getElementById('openRate').textContent = data.openRate ? (data.openRate) + "%" : "0%";
    })
    .catch(err => {
        console.error("Error fetching stats:", err);
    });
}

async function loadNewsletterData(newsletterId) {
  token = localStorage.getItem("id_token");
  try {
    const response = await fetch(`https://api.dinod2.com/${version}/newsletters/${encodeURIComponent(newsletterId)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      }
    });

    if (response.status === 401) {
      retry();
    } if (!response.ok) {
      throw new Error(`Failed to load newsletter: ${response.status}`);
    }

    const newsletter = await response.json();

  setNewsletterDetails(newsletter);

  return newsletter
  } catch (err) {
    toastMessage("Error loading newsletter. Please refresh", false);
    console.error("Error loading newsletter:", err);
    return null;
  }
}

function setNewsletterDetails(newsletter) {
  document.getElementById('subject').value = newsletter.subject || "Untitled";
  document.getElementById('preview').value = newsletter.preview || "";
  newsletterData = newsletter.content || "";
  document.getElementById('sendDate').value = newsletter.sendDate || "";
  document.getElementById('pageTitle').textContent = "Edit Newsletter";

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
    token = localStorage.getItem("id_token");
    try {
        const response = await fetch(`https://api.dinod2.com/${version}/upload`, {
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
            const theUrl = await response.json();
            return theUrl
        }
    } catch (error) {
        toastMessage("Error getting image URL. Try again.", false);
        console.error("Error fetching signed URL:", error);
        return null;
    }
}

async function uploadImage(event) {
    const image = event.attachment.file;
    if (!image) {
        return;
    }

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

            var attributes = {
                url: imageLink,
                href: imageLink + "?content-disposition=attachment"
            };

            event.attachment.setAttributes(attributes);

            posthog.capture('newsletter_image_uploaded', {
                newsletterId: newsletterId,
                successful: true,
                imageUrl: imageLink,
                contentType: image.type
            });
            toastMessage("Image uploaded.")
            return true;
        } else {
            throw new Error(`HTTP error! Status: ${response.status}`);
        };
    } catch (error) {
        toastMessage("Error uploading image. Try again", false);
        console.error("Error uploading image:", error);
        return false;
    }
}

async function handleFormSubmit(event) {
  event.preventDefault();

  subject = document.getElementById('subject').value || "";
  preview = document.getElementById('preview').value || "";
  content = document.getElementById('content').value || "";
  sendDate = document.getElementById('sendDate').value || "";

  const payload = {
    subject: subject,
    preview: preview,
    content: content,
    sendDate: sendDate
  };

  try {
    const version = getAPIMode();
    token = localStorage.getItem("id_token");
    const response = await fetch(
      `https://api.dinod2.com/${version}/newsletters/${encodeURIComponent(newsletterId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token
        },
        body: JSON.stringify(payload)
      }
    );

    if (response.status === 401) {
      retry();
    } if (!response.ok) {
      throw new Error("Failed to save newsletter");
    }

    toastMessage("Newsletter saved", true);
    posthog.capture('newsletter_saved', {
      newsletterId: newsletterId,
      successful: true
    });

    // Update local variable
    Object.assign(newsletter, payload);
  } catch (err) {
    toastMessage("Failed to save newsletter", false);
    posthog.capture('newsletter_saved', {
      newsletterId: newsletterId,
      successful: false
    });
    console.error(err.message);
  }
}

async function updateSendDate() {
  sendDate = document.getElementById('sendDate').value || ""

  const payload = {
    sendDate: sendDate
  };

  try {
    const version = getAPIMode();
    token = localStorage.getItem("id_token");
    const response = await fetch(
      `https://api.dinod2.com/${version}/newsletters/${encodeURIComponent(newsletterId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token
        },
        body: JSON.stringify(payload)
      }
    );

    if (response.status === 401) {
      retry();
    } if (!response.ok) {
      throw new Error("Failed to update send date");
    }

    toastMessage("Updated send date", true);

    // Update local sendDate
    newsletter.sendDate = sendDate;
  } catch (err) {
    toastMessage("Failed to update send date", false);
    console.error(err.message);
  }
}

async function sendPreviewEmail(event) {
  await handleFormSubmit(event);
  token = localStorage.getItem("id_token");

  try {
      const response = await fetch(`https://api.dinod2.com/${version}/email`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              Authorization: token
          },
          body: JSON.stringify({
              newsletterId: newsletterId,
              previewEmail: true
          })
      });

      if (response.status === 401) {
          retry();
      } if (response.ok) {
          return true;
      } else {
          const error = await response.text();
          console.error(error);
          return false;
      }
  } catch (err) {
      console.error(err);
      return false;
  }
}

async function broadcastEmail(event) {
  await handleFormSubmit(event);

  const payload = {
    newsletterId: newsletterId
  };

  if (newsletter.stage !== "Draft") {
    const message = "This newsletter has already been sent";
    toastMessage(message, false);
    console.error(message);
    return
  }

  try {
    const version = getAPIMode();
    token = localStorage.getItem("id_token");
    const response = await fetch(
      `https://api.dinod2.com/${version}/emailAll`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token
        },
        body: JSON.stringify(payload)
      }
    );

    if (response.status === 401) {
      retry();
    } if (!response.ok) {
      const message = "Failed to send newsletter";
      throw new Error(message);
    }

    newsletter.stage = "Sent"
    return true;
  } catch (err) {
    console.error(err.message);
    return false;
  }
}

async function deleteNewsletter() {
  try {
    const version = getAPIMode();
    token = localStorage.getItem("id_token");
    const response = await fetch(
      `https://api.dinod2.com/${version}/newsletters/${encodeURIComponent(newsletterId)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: token
        }
      }
    );

    if (response.status === 401) {
      retry();
    } if (!response.ok) {
      throw new Error("Failed to delete newsletter");
    }

    return true;
  } catch (err) {
    console.error(err.message);
    return false;
  }
}

async function getTemplate() {
    const response = await fetch("https://dinod2templates.s3.us-east-1.amazonaws.com/newsletterTemplateOriginal.html");

    const body = response.text();
    body.then(res => {
        template = res;
        return res;
    });

    template = body;

    return;
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
    const content = document.getElementById("content").value;
    const data = {
        tracking_url: "",
        content: content,
        businessAddress: "8561 Gander Creek Dr"
    };
    const previewData = safeSubstitute(templateString, data);
    targetWindow.postMessage(previewData);
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
        getStats();
        getTemplate();

        if (form) {
          form.addEventListener("submit", handleFormSubmit);
        }

        const existingEditor = document.querySelector("trix-editor");
        if (existingEditor && existingEditor.editor) {
            handleTrixInitialize({ target: existingEditor });
        }
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
  if (event.target == modal) {
    modal.style.display = "none";
  }
} 

//#endregion

//#region BUTTONS
document.getElementById('backBtn').onclick = () => {
  posthog.capture('newslettersPage_visit');
  window.location.href = "/";
};

document.getElementById("changeSend").onclick = () => {
  modal.style.display = "block";
};

document.getElementById("submitDate").onclick = async => {
  updateSendDate();
  modal.style.display = "none";
}

document.getElementsByClassName("close")[0].onclick = () => {
  modal.style.display = "none";
}

document.getElementById("previewNewsletter").onclick = async (event) => {
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
};

document.getElementById("livePreviewNewsletter").onclick = async (event) => {
  livePreview = livePreview ? false : true;
  livePreview ? getTemplate() : null;
  preview.style.display = livePreview ? "flex" : "none";
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
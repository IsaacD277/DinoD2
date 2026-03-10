const editor = document.querySelector("trix-editor");
let receiving = false;
let autoSave = null;
let masterAutoSave = null;
const newsletterId = getNewsletterId();

function getNewsletterId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('newsletterId');
}

window.addEventListener("message", (event) => {
    receiving = true;
    if (editor) editor.editor.loadHTML(event.data.content || "");
    editor.editor.setSelectedRange(event.data.selection);
    setTimeout(async () => {
        receiving = false;
    }, 100);
});

addEventListener("trix-change", () => {
    if (!receiving) {
        let selection = editor.editor.getSelectedRange();
        let content = document.getElementById("content").value;
        // content = adjustContentProperties(content);
        let data = {
            "content": content,
            "selection": selection
        }
        window.top.postMessage(data);
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
        window.top.postMessage(data);
    }
});

editor.addEventListener("trix-attachment-add", (event) => {
    if (event.attachment.file) {
        uploadImage(event);
    }
});

addEventListener("trix-file-accept", (e) => {
    if (receiving) {
        e.preventDefault();
    }
});

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

            if (event) {
              return true;
            }
            
            return imageLink;
        } else {
            throw new Error(`HTTP error! Status: ${response.status}`);
        };
    } catch (error) {
        console.error("Error uploading image:", error);
        return false;
    }
}

function adjustContentProperties(content) {
  // Replace H1 Tags with H2 Tags
  content = content.replace(/<h1(\s*[^>]*)>/g, "<h2$1>");
  content = content.replace(/<\/h1>/g, "</h2>");
  return content;
}

addEventListener("trix-change", () => {
    clearTimeout(autoSave);
    if (!receiving) {
        let selection = editor.editor.getSelectedRange();
        let content = document.getElementById("content").value;
        let data = {
            "content": content,
            "selection": selection
        }
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
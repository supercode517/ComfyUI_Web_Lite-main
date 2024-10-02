let jsonData;


async function loadJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}


function createFormGroup(groupId, groupData) {
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "p-3";

  let hasInputs = false;

  for (const [key, value] of Object.entries(groupData.inputs)) {
    if (!Array.isArray(value)) {
      const label = document.createElement("label");
      label.className = "block mb-1 text-sm";
      label.textContent = key;
      const inputField = createInputField(groupId, key, value);
      contentWrapper.appendChild(label);
      contentWrapper.appendChild(inputField);
      hasInputs = true;
    }
  }


  if (!hasInputs) {
    return null;
  }

  const group = document.createElement("div");
  group.className = "mb-4 border rounded-lg overflow-hidden";

  const groupHeader = document.createElement("div");
  groupHeader.className = "bg-gray-100 p-2 cursor-pointer flex items-center";

  const toggleIcon = document.createElement("span");
  toggleIcon.className = "mr-2 transition-transform duration-300";
  toggleIcon.textContent = "▼";

  const groupTitle = document.createElement("h3");
  groupTitle.className = "text-sm font-semibold flex-grow";
  groupTitle.textContent = groupData.class_type;

  groupHeader.appendChild(toggleIcon);
  groupHeader.appendChild(groupTitle);
  group.appendChild(groupHeader);
  group.appendChild(contentWrapper);


  let isExpanded = true;
  groupHeader.addEventListener("click", () => {
    isExpanded = !isExpanded;
    contentWrapper.style.display = isExpanded ? "block" : "none";
    toggleIcon.style.transform = isExpanded ? "rotate(0deg)" : "rotate(-90deg)";
  });

  return group;
}


function createInputField(groupId, name, value) {
  const input = document.createElement("input");
  input.name = name;
  input.value = value;
  input.className = "w-full p-2 mb-2 border rounded";

  if (typeof value === "string") {
    input.type = "text";
  } else if (typeof value === "number") {
    input.type = "number";
  }

  input.addEventListener("input", (event) => {
    let newValue = event.target.value;
    if (input.type === "number") {
      newValue = Number(newValue);
    }
    updateJsonValue(groupId, name, newValue);
  });

  return input;
}


function updateJsonValue(groupId, key, newValue) {
  jsonData[groupId].inputs[key] = newValue;
}


function updateSubmitButtonState() {
  const submitButton = $("#submit-button");
  const formContainer = $("#form-container");

  if (formContainer.children().length === 0) {
    submitButton.prop('disabled', true);
    submitButton.addClass("disabled:opacity-75 cursor-not-allowed");
  } else {
    submitButton.prop('disabled', false);
    submitButton.removeClass("disabled:opacity-75 cursor-not-allowed");
  }
}


function generateForm(data) {
  const formContainer = document.getElementById("form-container");
  formContainer.innerHTML = '';
  for (const [groupId, groupData] of Object.entries(data)) {
    const formGroup = createFormGroup(groupId, groupData);
    if (formGroup) {
      formContainer.appendChild(formGroup);
    }
  }


  updateSubmitButtonState();
}


function loadImagesFromLocalStorage() {
  console.log("从 localStorage 加载图片");
  const storedData = JSON.parse(localStorage.getItem('comfyui-web-lite')) || { images: [] };
  console.log("存储的图片:", storedData.images);
  const imageContainer = document.getElementById('image-container');
  imageContainer.innerHTML = '';

  storedData.images.reverse().forEach(imageUrl => addImageCard(imageUrl));
}


function addImageCard(imageUrl) {
  console.log("添加图片卡片，URL:", imageUrl);
  const imageContainer = document.getElementById('image-container');
  const card = document.createElement('div');
  card.className = 'bg-white rounded-lg shadow-md overflow-hidden mb-4 relative grow-0';
  card.style.width = '200px';
  card.style.height = '200px';
  card.innerHTML = `
    <img src="${imageUrl}" alt="Generated Image" class="w-full h-full object-cover cursor-pointer">
    <button class="delete-image absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition duration-300 text-xs">&times;</button>
  `;

  card.querySelector('.delete-image').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteImage(imageUrl);
    card.remove();
  });

  card.querySelector('img').addEventListener('click', () => {
    showFullscreenImage(imageUrl);
  });


  imageContainer.insertBefore(card, imageContainer.firstChild);
}

function showFullscreenImage(imageUrl) {
  const fullscreenContainer = document.getElementById('fullscreen-container');
  const fullscreenImage = document.getElementById('fullscreen-image');

  fullscreenImage.src = imageUrl;
  fullscreenContainer.classList.remove('hidden');
}


function deleteImage(imageUrl) {
  const storedData = JSON.parse(localStorage.getItem('comfyui-web-lite')) || { images: [] };
  storedData.images = storedData.images.filter(url => url !== imageUrl);
  localStorage.setItem('comfyui-web-lite', JSON.stringify(storedData));
}


function addImageToLocalStorage(imageUrl) {
  const storedData = JSON.parse(localStorage.getItem('comfyui-web-lite')) || { images: [] };

  storedData.images.unshift(imageUrl);
  localStorage.setItem('comfyui-web-lite', JSON.stringify(storedData));
}


function generate(prompt, client_id) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      "ws://" + server_address + "/ws?clientId=" + client_id
    );

    const timeout = setTimeout(() => {
      reject(new Error("生成超时"));
      socket.close();
    }, 30000);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received WebSocket message:", data);

      if (data.type === "executed" && "images" in data.data.output) {
        clearTimeout(timeout);
        const image = data.data.output.images[0];
        const filename = image.filename;
        const subfolder = image.subfolder;
        const imageAddress =
          "http://" +
          server_address +
          "/view?filename=" +
          filename +
          "&type=output&subfolder=" +
          subfolder;


        addImageToLocalStorage(imageAddress);

        console.log("Generated image address:", imageAddress);
        addImageCard(imageAddress);
        resolve(imageAddress);
        socket.close();
      }
    };

    socket.onerror = (error) => {
      clearTimeout(timeout);
      console.error("WebSocket error:", error);
      reject(error);
      socket.close();
    };

    fetch("http://" + server_address + "/prompt", {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: prompt, client_id: client_id }),
    }).catch((error) => {
      clearTimeout(timeout);
      console.error("Fetch error:", error);
      reject(error);
      socket.close();
    });
  });
}

$(document).ready(function () {
  console.log("Document ready, loading images");
  const server_address = "127.0.0.1:8188";


  function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );
  }
  const client_id = uuidv4();


  function generate(prompt, client_id) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        "ws://" + server_address + "/ws?clientId=" + client_id
      );

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message:", data);

        if (data.type === "executed" && "images" in data.data.output) {
          const image = data.data.output.images[0];
          const filename = image.filename;
          const subfolder = image.subfolder;
          const imageAddress =
            "http://" +
            server_address +
            "/view?filename=" +
            filename +
            "&type=output&subfolder=" +
            subfolder;
          console.log("Generated image address:", imageAddress);
          addImageToLocalStorage(imageAddress);
          addImageCard(imageAddress);
          resolve(imageAddress);
          socket.close();
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
        socket.close();
      };

      fetch("http://" + server_address + "/prompt", {
        method: "POST",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt, client_id: client_id }),
      }).catch((error) => {
        console.error("Fetch error:", error);
        reject(error);
        socket.close();
      });
    });
  }


  $("#upload-flow-json").on("change", function (event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function (event) {
      jsonData = JSON.parse(event.target.result);
      console.log("Uploaded JSON:", jsonData);
      generateForm(jsonData);
    };

    reader.onerror = function (error) {
      console.error("Error reading JSON file:", error);
    };

    if (file) {
      reader.readAsText(file);
    } else {

      $("#form-container").empty();
      updateSubmitButtonState();
    }
  });


  $("#submit-button").on("click", async function () {
    const submitButton = $(this);


    if (submitButton.prop('disabled')) {
      return;
    }

    submitButton.addClass("disabled:opacity-75 cursor-not-allowed");
    submitButton.prop('disabled', true);
    submitButton.text('Generate...');

    const promptProcess = JSON.stringify(jsonData);
    const prompt = JSON.parse(promptProcess);
    console.log("prompt:", prompt);

    try {
      const imageAddress = await generate(prompt, client_id);
      console.log("Generated image address:", imageAddress);
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      submitButton.removeClass("disabled:opacity-75 cursor-not-allowed");
      submitButton.prop('disabled', false);
      submitButton.text('Generate Image');
      updateSubmitButtonState();
    }
  });


  loadImagesFromLocalStorage();


  $('#close-fullscreen, #fullscreen-container').on('click', function (e) {
    if (e.target === this) {
      $('#fullscreen-container').addClass('hidden');
    }
  });


  $('#fullscreen-image').on('click', function (e) {
    e.stopPropagation();
  });
});

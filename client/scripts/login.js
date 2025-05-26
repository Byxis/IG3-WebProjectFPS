import { ErrorTypes } from "../enum/ErrorTypes.js";
import { refreshAuthToken } from "../libs/AuthManager.js";
import { API_URL, CLIENT_URL } from "../config/config.js";

document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(globalThis.location.search);
  const errorType = urlParams.get("error");

  try {
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      globalThis.location.href = CLIENT_URL;
      return;
    }
  } catch (error) {
    console.error("Failed to restore session:", error);
  }

  // Handle URL error parameters
  if (errorType) {
    switch (parseInt(errorType)) {
      case ErrorTypes.AUTH_REQUIRED:
        showError(
          "Your session has expired. Please log in again.",
          "login-error",
        );
        break;
      case ErrorTypes.AUTH_FAILED:
        showError("Authentication failed. Please log in again.", "login-error");
        break;
      case ErrorTypes.ACCESS_DENIED:
        showError(
          "Access denied. Please log in with appropriate credentials.",
          "login-error",
        );
        break;
      case ErrorTypes.BANNED:
        showError(
          "Your account has been suspended from the server.",
          "login-error",
        );
        break;
      default:
        showError("An error occurred. Please try again.", "login-error");
    }
  }
});

const tabs = document.querySelectorAll(".tab-btn");
const indicator = document.querySelector(".tab-indicator");
const registerForm = document.getElementById("register-form");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const registerUsername = document.getElementById("register-username");
const registerPassword = document.getElementById("register-password");
const confirmPassword = document.getElementById("register-confirm");
const submitBtn = document.getElementById("submit-btn");
const registerBtn = document.getElementById("register-btn");

/**
 ** Updates the tab indicator position
 * @param {HTMLElement} activeTab - The active tab element
 */
function positionIndicator(activeTab) {
  indicator.style.width = `${activeTab.offsetWidth * 0.8}px`;
  indicator.style.left = `${
    activeTab.offsetLeft + activeTab.offsetWidth * 0.1
  }px`;
}

positionIndicator(document.querySelector(".tab-btn.active"));

tabs.forEach((button) => {
  button.addEventListener("click", () => {
    tabs.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    positionIndicator(button);

    document.querySelectorAll(".tab-content").forEach((content) =>
      content.classList.remove("active")
    );
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

/**
 ** Displays an error message
 * @param {string} message - The error message to display
 * @param {string} elementId - The ID of the element to show the error in
 */
function showError(message, elementId = "register-error") {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = "block";
  }
}

/**
 ** Hides an error message
 * @param {string} elementId - The ID of the element containing the error
 */
function hideError(elementId = "register-error") {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.style.display = "none";
  }
}

/**
 ** Shows a rate limit error with countdown timer
 * @param {string} message - The error message to display
 * @param {number} retryAfterSeconds - Time in seconds before retry is allowed
 */
function showRateLimitError(message, retryAfterSeconds) {
  const errorElement = document.getElementById("login-error");
  if (errorElement) {
    let countdown = retryAfterSeconds;
    const baseMessage = message;

    const updateMessage = () => {
      const minutes = Math.floor(countdown / 60);
      const seconds = countdown % 60;
      const timeString = minutes > 0
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;

      errorElement.textContent = `${baseMessage} (Retry in: ${timeString})`;
    };

    updateMessage();
    errorElement.style.display = "block";

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-clock"></i> Rate Limited';

    const interval = setInterval(() => {
      countdown--;

      if (countdown <= 0) {
        clearInterval(interval);
        errorElement.style.display = "none";
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'LOGIN <i class="fas fa-arrow-right"></i>';
      } else {
        updateMessage();
      }
    }, 1000);
  }
}

/**
 ** Validates the registration password
 * @returns {boolean} Whether the password is valid
 */
function validatePassword() {
  if (registerPassword.value === "") {
    showError("Password cannot be empty");
    return false;
  } else if (registerPassword.value.length < 6) {
    showError("Password must be at least 6 characters");
    return false;
  } else if (confirmPassword.value === "") {
    showError("Please confirm your password");
    return false;
  } else if (registerPassword.value !== confirmPassword.value) {
    showError("Passwords do not match");
    return false;
  } else {
    hideError();
    return true;
  }
}

/**
 ** Validates the login username
 * @returns {boolean} Whether the username is valid
 */
function validateLoginUsername() {
  if (loginUsername.value === "") {
    showError("Username cannot be empty");
    return false;
  } else if (loginUsername.value.length < 3) {
    showError("Username must be at least 3 characters");
    return false;
  }
  return true;
}

/**
 ** Validates the registration username
 * @returns {boolean} Whether the username is valid
 */
function validateRegisterUsername() {
  if (registerUsername.value === "") {
    showError("Username cannot be empty");
    return false;
  } else if (registerUsername.value.length < 3) {
    showError("Username must be at least 3 characters");
    return false;
  }
  hideError();
  return true;
}

loginPassword.addEventListener("input", validatePassword);
confirmPassword.addEventListener("input", validatePassword);

registerForm.addEventListener("submit", function (event) {
  if (!validatePassword()) {
    event.preventDefault();
  }
});

registerUsername.addEventListener("input", function () {
  if (registerUsername.value === "") {
    showError("Username cannot be empty");
  } else if (registerUsername.value.length < 3) {
    showError("Username must be at least 3 characters");
  } else {
    validatePassword();
  }
});

submitBtn.addEventListener("click", function (event) {
  event.preventDefault();
  submit();
});

/**
 ** Handles the login form submission
 */
async function submit() {
  hideError("login-error");

  if (validateLoginUsername() && loginPassword.value !== "") {
    const data = {
      "username": loginUsername.value,
      "password": loginPassword.value,
    };

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Logging in...';

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        mode: "cors",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        console.log("Login successful");
        const data = await response.json();
        localStorage.setItem("username", data.username);
        globalThis.location.href = CLIENT_URL;
      } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'LOGIN <i class="fas fa-arrow-right"></i>';

        const errorData = await response.json();

        if (errorData && errorData.error) {
          console.error("Error:", errorData);

          if (response.status === 429 && errorData.retryAfter) {
            showRateLimitError(errorData.error, errorData.retryAfter);
          } else {
            showError(
              errorData.error || errorData.message || "Login failed",
              "login-error",
            );
          }
        } else {
          if (response.status === ErrorTypes.ACCESS_DENIED) {
            showError("Invalid username or password.", "login-error");
          } else if (response.status === ErrorTypes.RATE_LIMITED) {
            showError(
              "Too many login attempts. Please try again later.",
              "login-error",
            );
          } else if (response.status === ErrorTypes.BANNED) {
            showError("Your account has been banned.", "login-error");
          } else {
            showError("Login failed. Please try again.", "login-error");
          }
        }
      }
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'LOGIN <i class="fas fa-arrow-right"></i>';
      console.error("Error:", error);
      showError(
        "Server connection error. Please try again later.",
        "login-error",
      );
    }
  } else {
    showError("Please check username and password", "login-error");
  }
}

loginUsername.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    loginPassword.focus();
  }
});

loginPassword.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    submit();
  }
});

registerUsername.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    registerPassword.focus();
  }
});

registerPassword.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    confirmPassword.focus();
  }
});

confirmPassword.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    register();
  }
});

registerBtn.addEventListener("click", function (event) {
  event.preventDefault();
  register();
});

/**
 ** Handles the registration form submission
 */
async function register() {
  if (validateRegisterUsername() && validatePassword()) {
    const data = {
      "username": registerUsername.value,
      "password": registerPassword.value,
    };

    try {
      registerBtn.disabled = true;
      registerBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Registering...';

      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        mode: "cors",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("username", data.username);
        globalThis.location.href = CLIENT_URL;
      } else {
        registerBtn.disabled = false;
        registerBtn.innerHTML = 'REGISTER <i class="fas fa-user-plus"></i>';

        const errorData = await response.json();

        if (errorData && errorData.message) {
          showError(errorData.message);
        } else {
          if (response.status === 409) {
            showError("Username already taken. Please choose another one.");
          } else {
            showError("Registration failed. Please try again.");
          }
        }
      }
    } catch (error) {
      registerBtn.disabled = false;
      registerBtn.innerHTML = 'REGISTER <i class="fas fa-user-plus"></i>';
      console.error("Error:", error);
      showError("Server connection error. Please try again later.");
    }
  }
}

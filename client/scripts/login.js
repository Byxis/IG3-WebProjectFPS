import { ErrorTypes } from "../enum/ErrorTypes.js";
import { refreshAuthToken } from "../libs/AuthManager.js";
import { API_URL, CLIENT_URL } from "../config/config.js";

document.addEventListener('DOMContentLoaded', async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const errorType = urlParams.get('error');
  
  try {
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      window.location.href = CLIENT_URL;
      return;
    }
  } catch (error) {
    console.error("Failed to restore session:", error);
  }
  
  // Handle URL error parameters
  if (errorType) {
    switch(parseInt(errorType)) {
      case ErrorTypes.AUTH_REQUIRED:
        showError('Your session has expired. Please log in again.', 'login-error');
        break;
      case ErrorTypes.AUTH_FAILED:
        showError('Authentication failed. Please log in again.', 'login-error');
        break;
      case ErrorTypes.ACCESS_DENIED:
        showError('Access denied. Please log in with appropriate credentials.', 'login-error');
        break;
      case ErrorTypes.BANNED:
        showError('Your account has been suspended from the server.', 'login-error');
        break;
      default:
        showError('An error occurred. Please try again.', 'login-error');
    }
  }
});

const tabs = document.querySelectorAll('.tab-btn');
const indicator = document.querySelector('.tab-indicator');
const registerForm = document.getElementById('register-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const registerUsername = document.getElementById('register-username');
const registerPassword = document.getElementById('register-password');
const confirmPassword = document.getElementById('register-confirm');
const registerError = document.getElementById('register-error');
const submitBtn = document.getElementById('submit-btn');
const registerBtn = document.getElementById('register-btn');

function positionIndicator(activeTab) {
  indicator.style.width = `${activeTab.offsetWidth * 0.8}px`;
  indicator.style.left = `${activeTab.offsetLeft + activeTab.offsetWidth * 0.1}px`;
}

positionIndicator(document.querySelector('.tab-btn.active'));

tabs.forEach(button => {
  button.addEventListener('click', () => {
    tabs.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    positionIndicator(button);
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(button.dataset.tab).classList.add('active');
  });
});

function showError(message, elementId = 'register-error') {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

function hideError(elementId = 'register-error') {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.style.display = 'none';
  }
}

function validatePassword() {
  if (registerPassword.value === '') {
    showError('Password cannot be empty');
    return false;
  } else if (registerPassword.value.length < 6) {
    showError('Password must be at least 6 characters');
    return false;
  } else if (confirmPassword.value === '') {
    showError('Please confirm your password');
    return false;
  } else if (registerPassword.value !== confirmPassword.value) {
    showError('Passwords do not match');
    return false;
  } else {
    hideError();
    return true;
  }
}

function validateLoginUsername() {
  if (loginUsername.value === '') {
    showError('Username cannot be empty');
    return false;
  } else if (loginUsername.value.length < 3) {
    showError('Username must be at least 3 characters');
    return false;
  }
  return true;
}

function validateRegisterUsername() {
  if (registerUsername.value === '') {
    showError('Username cannot be empty');
    return false;
  } else if (registerUsername.value.length < 3) {
    showError('Username must be at least 3 characters');
    return false;
  }
  hideError();
  return true;
}

loginPassword.addEventListener('input', validatePassword);
confirmPassword.addEventListener('input', validatePassword);

registerForm.addEventListener('submit', function(event) {
  if (!validatePassword()) {
    event.preventDefault();
  }
});

registerUsername.addEventListener('input', function() {
  if (registerUsername.value === '') {
    showError('Username cannot be empty');
  } else if (registerUsername.value.length < 3) {
    showError('Username must be at least 3 characters');
  } else {
    validatePassword();
  }
});

submitBtn.addEventListener("click", function(event) {
  event.preventDefault();
  submit();
});

async function submit() {
  hideError('login-error');
  
  if(validateLoginUsername() && loginPassword.value !== "") {
    let data = {
      "username": loginUsername.value,
      "password": loginPassword.value
    };
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
      
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        mode: "cors",
        credentials: "include",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        console.log("Login successful");
        const data = await response.json();
        localStorage.setItem('username', data.username);
        window.location.href = CLIENT_URL;
      } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'LOGIN <i class="fas fa-arrow-right"></i>';
        
        const errorData = await response.json();
        
        if (errorData && errorData.error) {
          console.error("Error:", errorData);
          showError(errorData.message || "Login failed", 'login-error');
        } else {
          if (response.status === ErrorTypes.ACCESS_DENIED) {
            showError('Invalid username or password.', 'login-error');
          } else if (response.status === ErrorTypes.RATE_LIMITED) {
            showError('Too many login attempts. Please try again later.', 'login-error');
          } else if (response.status === ErrorTypes.BANNED) {
            showError('Your account has been banned.', 'login-error');
          } else {
            showError('Login failed. Please try again.', 'login-error');
          }
        }
      }
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'LOGIN <i class="fas fa-arrow-right"></i>';
      console.error("Error:", error);
      showError('Server connection error. Please try again later.', 'login-error');
    }
  } else {
    showError('Please check username and password', 'login-error');
  }
}

loginUsername.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    loginPassword.focus();
  }
});

loginPassword.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    submit();
  }
});

registerUsername.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    registerPassword.focus();
  }
});

registerPassword.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    confirmPassword.focus();
  }
});

confirmPassword.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    register();
  }
});

registerBtn.addEventListener("click", function(event) {
  event.preventDefault(); 
  register();
});

async function register() {
  if(validateRegisterUsername() && validatePassword()) {
    let data = {
      "username": registerUsername.value,
      "password": registerPassword.value
    };
    
    try {
      registerBtn.disabled = true;
      registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
      
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        mode: "cors",
        credentials: "include",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('username', data.username);
        window.location.href = CLIENT_URL;
      } else {
        registerBtn.disabled = false;
        registerBtn.innerHTML = 'REGISTER <i class="fas fa-user-plus"></i>';
        
        const errorData = await response.json();
        
        if (errorData && errorData.message) {
          showError(errorData.message);
        } else {
          if (response.status === 409) {
            showError('Username already taken. Please choose another one.');
          } else {
            showError('Registration failed. Please try again.');
          }
        }
      }
    } catch (error) {
      registerBtn.disabled = false;
      registerBtn.innerHTML = 'REGISTER <i class="fas fa-user-plus"></i>';
      console.error("Error:", error);
      showError('Server connection error. Please try again later.');
    }
  }
}
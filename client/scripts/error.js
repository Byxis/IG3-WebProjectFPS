import { ErrorTypes } from "../enum/ErrorTypes.js";
import { refreshAuthToken } from "../libs/AuthManager.js";
import { API_URL } from "../config/config.js";

document.addEventListener('DOMContentLoaded', () => {
  const errorTitle = document.getElementById('error-title');
  const errorMessage = document.getElementById('error-message');
  const errorDetails = document.getElementById('error-details');
  const retryButton = document.getElementById('retry-btn');
  const loginButton = document.getElementById('login-btn');
  
  const urlParams = new URLSearchParams(window.location.search);
  const errorType = parseInt(urlParams.get('type')) || ErrorTypes.UNKNOWN;
  const attempts = urlParams.get('attempts') || '0';
  const redirectFrom = urlParams.get('from') || '';
  
  let currentErrorType = errorType;
  
  configureErrorDisplay(currentErrorType, attempts, redirectFrom);
  
  const autoRetry = document.getElementById('auto-retry');
  let countdownElement = document.getElementById('countdown');
  let countdown = 5;
  let reconnectAttempts = parseInt(attempts) || 0;
  const maxReconnectAttempts = 20;

  if (currentErrorType === ErrorTypes.SERVER_UNREACHABLE && autoRetry && countdownElement) {
    autoRetry.style.display = 'block';
    startReconnectCountdown();
  }
  
  function startReconnectCountdown() {
    reconnectAttempts++;
    countdown = 5;
    
    updateUrlParam('attempts', reconnectAttempts.toString());
    
    countdownElement.textContent = countdown;
    
    const interval = setInterval(() => {
      countdown--;
      countdownElement.textContent = countdown;
      
      if (countdown <= 0) {
        clearInterval(interval);
        
        if (currentErrorType === ErrorTypes.AUTH_REQUIRED || 
            currentErrorType === ErrorTypes.AUTH_FAILED) {
          refreshAuthToken()
            .then(refreshed => {
              if (refreshed) {
                window.location.href = 'index.html';
              } else {
                window.location.href = `login.html?error=${currentErrorType}`;
              }
            })
            .catch(() => {
              window.location.href = `login.html?error=${currentErrorType}`;
            });
          return;
        }
        
        checkServerConnection()
          .then(result => {
            if (result.isConnected) {
              window.location.href = 'index.html';
            } else if (result.errorType !== currentErrorType) {
              currentErrorType = result.errorType;
              updateUrlParam('type', currentErrorType);
              configureErrorDisplay(currentErrorType, reconnectAttempts, redirectFrom);
              
              if (currentErrorType === ErrorTypes.AUTH_REQUIRED || 
                  currentErrorType === ErrorTypes.AUTH_FAILED) {
                refreshAuthToken()
                  .then(refreshed => {
                    if (refreshed) {
                      window.location.href = 'index.html';
                    } else {
                      loginButton.style.display = 'block';
                      retryButton.style.display = 'none';
                      autoRetry.style.display = 'none';
                    }
                  });
                return;
              }
              
              if (currentErrorType === ErrorTypes.ACCESS_DENIED || 
                  currentErrorType === ErrorTypes.BANNED) {
                return;
              }
            }
            
            if (reconnectAttempts <= maxReconnectAttempts) {
              const errorMessage = document.getElementById('error-message');
              errorMessage.textContent = `Unable to connect to the game server after ${reconnectAttempts} attempts.`;
              
              autoRetry.innerHTML = 'Automatically retrying in <span id="countdown">5</span> seconds...';
              countdownElement = document.getElementById('countdown');
              startReconnectCountdown();
            } else {
              autoRetry.textContent = 'Maximum reconnection attempts reached. Please try manually.';
            }
          });
      }
    }, 1000);
  }
  
  function updateUrlParam(key, value) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState({}, '', url);
  }
  
  retryButton.addEventListener('click', async () => {
    if (currentErrorType === ErrorTypes.AUTH_REQUIRED || 
        currentErrorType === ErrorTypes.AUTH_FAILED) {
      
      retryButton.disabled = true;
      retryButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Trying...';
      
      try {
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          window.location.href = 'index.html';
          return;
        }
        
        window.location.href = `login.html?error=${currentErrorType}`;
        return;
      } catch (e) {
        retryButton.disabled = false;
        retryButton.innerHTML = '<i class="fas fa-sync-alt"></i> Retry';
        errorDetails.textContent = 'Token refresh failed. Please try logging in again.';
        errorDetails.style.color = '#ff4655';
        setTimeout(() => {
          window.location.href = `login.html?error=${currentErrorType}`;
        }, 2000);
        return;
      }
    }
    
    checkServerConnection()
      .then(result => {
        if (result.isConnected) {
          window.location.href = 'index.html';
        } else if (result.errorType !== currentErrorType) {
          currentErrorType = result.errorType;
          updateUrlParam('type', currentErrorType);
          configureErrorDisplay(currentErrorType, reconnectAttempts, redirectFrom);
        } else {
          const originalText = errorDetails.textContent;
          errorDetails.textContent = 'Server is still unreachable. Please try again later.';
          errorDetails.style.color = '#ff4655';
          
          setTimeout(() => {
            errorDetails.textContent = originalText;
            errorDetails.style.color = '';
          }, 3000);
        }
      });
  });
  
  loginButton.addEventListener('click', () => {
    window.location.href = `login.html?error=${currentErrorType}`;
  });
});

async function checkServerConnection() {
  try {
    if (await refreshAuthToken()) {
      return { isConnected: true, errorType: null };
    }
    
    const response = await fetch(`${API_URL}/api/verify`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include'
    });
    
    if (response.ok) {
      return { isConnected: true, errorType: null };
    } else if (response.status === 401) {
      return { isConnected: false, errorType: ErrorTypes.AUTH_REQUIRED };
    } else if (response.status === 403) {
      return { isConnected: false, errorType: ErrorTypes.ACCESS_DENIED };
    } else if (response.status === 429) {
      return { isConnected: false, errorType: ErrorTypes.RATE_LIMITED };
    } else if (response.status === 410) {
      return { isConnected: false, errorType: ErrorTypes.BANNED };
    } else if (response.status >= 500) {
      return { isConnected: false, errorType: ErrorTypes.SERVER_ERROR };
    } else {
      return { isConnected: false, errorType: ErrorTypes.SERVER_UNREACHABLE };
    }
  } catch (error) {
    return { isConnected: false, errorType: ErrorTypes.SERVER_UNREACHABLE };
  }
}

function configureErrorDisplay(type, attempts, redirectFrom) {
  const errorTitle = document.getElementById('error-title');
  const errorMessage = document.getElementById('error-message');
  const errorDetails = document.getElementById('error-details');
  const retryButton = document.getElementById('retry-btn');
  const loginButton = document.getElementById('login-btn');
  const autoRetry = document.getElementById('auto-retry');
  
  switch (type) {
    case ErrorTypes.SERVER_UNREACHABLE:
      errorTitle.textContent = 'Server Unreachable';
      errorMessage.textContent = `Unable to connect to the game server after ${attempts} attempts.`;
      errorDetails.textContent = 'The server may be down for maintenance or experiencing high load. Please try again later.';
      loginButton.style.display = 'none';
      autoRetry.style.display = 'block';
      break;
      
    case ErrorTypes.AUTH_REQUIRED:
      errorTitle.textContent = 'Authentication Required';
      errorMessage.textContent = 'Your session has expired or is invalid.';
      errorDetails.textContent = 'Please log in again to continue.';
      retryButton.style.display = 'none';
      autoRetry.style.display = 'none';
      loginButton.style.display = 'block';
      break;
      
    case ErrorTypes.AUTH_FAILED:
      errorTitle.textContent = 'Authentication Failed';
      errorMessage.textContent = 'Unable to verify your identity.';
      errorDetails.textContent = 'Please log in again or contact support if this persists.';
      retryButton.style.display = 'none';
      autoRetry.style.display = 'none';
      loginButton.style.display = 'block';
      break;
      
    case ErrorTypes.ACCESS_DENIED:
      errorTitle.textContent = 'Access Denied';
      errorMessage.textContent = 'You do not have permission to access this resource.';
      errorDetails.textContent = 'Please log in with an account that has the required permissions.';
      retryButton.style.display = 'none';
      autoRetry.style.display = 'none';
      loginButton.style.display = 'block';
      break;
      
    case ErrorTypes.BANNED:
      errorTitle.textContent = 'Account Banned';
      errorMessage.textContent = 'Your account has been suspended from this server.';
      errorDetails.textContent = 'Please contact a server administrator for more information.';
      retryButton.style.display = 'none';
      autoRetry.style.display = 'none';
      break;
      
    case ErrorTypes.RATE_LIMITED:
      errorTitle.textContent = 'Rate Limited';
      errorMessage.textContent = 'You have exceeded the rate limit for requests.';
      errorDetails.textContent = 'Please wait a while before trying again.';
      retryButton.style.display = 'none';
      autoRetry.style.display = 'none';
      break;
      
    case ErrorTypes.SERVER_ERROR:
      errorTitle.textContent = 'Server Error';
      errorMessage.textContent = 'The server encountered an error.';
      errorDetails.textContent = 'Please try again later or contact support if this persists.';
      retryButton.style.display = 'none';
      autoRetry.style.display = 'none';
      break;
      
    default:
      errorTitle.textContent = 'Unknown Error';
      errorMessage.textContent = 'An unexpected error has occurred.';
      errorDetails.textContent = 'Please try again or contact support if this persists.';
      autoRetry.style.display = 'none';
  }
  
  if (redirectFrom) {
    errorDetails.textContent += ` (Redirected from: ${redirectFrom})`;
  }
}
